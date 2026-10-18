import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChatProvider } from '@/lib/chat';
import { api, type AiAskResponse } from '@/lib/api';
import { saveConversation, setCurrentConversation } from '@/lib/chat-store';
import type { ChatConversation } from '@/lib/chat-store';
import { ApiError } from '@/lib/errors';

import { AssistantPage } from './assistant';

const RESPONSE: AiAskResponse = {
  answer: 'Oat milk has 12 on hand with 3 days of cover.',
  citations: [
    { field: 'products.PROD-001.stockQuantity', value: '12' },
    { field: 'products.PROD-001.coverDays', value: '3' },
  ],
  proposals: [
    {
      productId: 'PROD-001',
      title: 'Raise oat milk to 60 units',
      field: 'plan.lines.PROD-001.editedBaseUnits',
      currentValue: '48',
      proposedValue: '60',
    },
  ],
  requestId: 'demo-ask-1',
  notice:
    'Advisory only — nothing was changed. Suggestions are drafts; applying one goes through the normal reorder review screen.',
};

function renderAssistant() {
  return render(
    <MemoryRouter initialEntries={['/assistant']}>
      <ChatProvider>
        <AssistantPage />
      </ChatProvider>
    </MemoryRouter>,
  );
}

async function ask(question: string) {
  await userEvent.type(screen.getByLabelText('Your question'), question);
  await userEvent.click(screen.getByRole('button', { name: 'Ask StockLoop' }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('assistant file attachments', () => {
  const UPLOAD_RESPONSE: AiAskResponse = {
    answer: 'Your upload lists 42 — from your upload, not your store.',
    citations: [{ field: 'file.upload.firstFigure', value: '42' }],
    proposals: [],
    requestId: 'demo-ask-file',
    notice: 'Advisory only — nothing was changed.',
  };

  function seedFile(name: string, content: string, type = 'text/csv') {
    return new File([content], name, { type });
  }

  async function attach(file: File) {
    // applyAccept:false — the component's own extension/size gate is what this
    // suite verifies; accept remains the browser-pointer filter.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText(/attach a file/i, { selector: 'input' }), file);
  }

  it('stages a .csv with chip, privacy note, and sends the file to api.ask', async () => {
    const spy = vi.spyOn(api, 'ask').mockResolvedValue(UPLOAD_RESPONSE);
    renderAssistant();
    await attach(seedFile('balance.csv', 'figure,amount\nfirst,42'.repeat(500)));

    expect(screen.getByTitle('balance.csv')).toBeInTheDocument();
    expect(screen.getByText('10.7 KB')).toBeInTheDocument();
    expect(
      screen.getByText(/File contents are sent to the configured AI provider/),
    ).toBeInTheDocument();

    await ask('What is in the file?');
    expect(await screen.findByText(UPLOAD_RESPONSE.answer)).toBeInTheDocument();
    expect(spy.mock.calls[0][0].file).toBeTypeOf('object');
  });

  it('clears the chip and privacy note after a successful answer', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue(UPLOAD_RESPONSE);
    renderAssistant();
    await attach(seedFile('balance.csv', 'amount\n42'));
    await ask('What is in the file?');
    await screen.findByText(UPLOAD_RESPONSE.answer);
    // Chip gone from the composer; answer keeps its file.* citation.
    expect(screen.queryByTitle('balance.csv')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/File contents are sent to the configured AI provider/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Source figures' })).toHaveTextContent(
      'file.upload.firstFigure = 42',
    );
  });

  it('labels the file.* citation as upload content in the answer', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue(UPLOAD_RESPONSE);
    renderAssistant();
    await attach(seedFile('balance.csv', 'amount\n42'));
    await ask('What is in the file?');
    await screen.findByText(UPLOAD_RESPONSE.answer);
    const sources = screen.getByRole('list', { name: 'Source figures' });
    expect(within(sources).getByText(/upload/i)).toBeInTheDocument();
  });

  it('keeps the chip after a failure and retry re-sends the same file', async () => {
    const spy = vi
      .spyOn(api, 'ask')
      .mockRejectedValueOnce(new ApiError(502, 'Provider quota exceeded.'))
      .mockResolvedValueOnce(UPLOAD_RESPONSE);
    renderAssistant();
    await attach(seedFile('balance.csv', 'amount\n42'));
    await ask('What is in the file?');
    expect(await screen.findByText('We couldn’t answer that.')).toBeInTheDocument();
    expect(screen.getByTitle('balance.csv')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(UPLOAD_RESPONSE.answer)).toBeInTheDocument();
    expect(spy.mock.calls[1][0].file).toBeTypeOf('object');
  });

  it('rejects .exe client-side without calling the API', async () => {
    const spy = vi.spyOn(api, 'ask');
    renderAssistant();
    await attach(seedFile('virus.exe', 'MZ', 'application/octet-stream'));
    expect(screen.getByText(/isn't supported/)).toBeInTheDocument();
    expect(screen.queryByTitle('virus.exe')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a file over 200 KB client-side without calling the API', async () => {
    const spy = vi.spyOn(api, 'ask');
    renderAssistant();
    await attach(seedFile('big.csv', 'x'.repeat(201 * 1024)));
    expect(screen.getByText(/isn't supported/)).toBeInTheDocument();
    expect(screen.queryByTitle('big.csv')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('never writes raw file contents to localStorage', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue(UPLOAD_RESPONSE);
    renderAssistant();
    await attach(seedFile('balance.csv', 'SECRETFILECONTENT 42'));
    await ask('What is in the file?');
    await screen.findByText(UPLOAD_RESPONSE.answer);
    const stored = window.localStorage.getItem('stockloop.chat.v1') ?? '';
    expect(stored).not.toContain('SECRETFILECONTENT');
    expect(stored).toContain('file.upload.firstFigure');
  });
});

describe('assistant page', () => {
  it('starts in an honest empty state', () => {
    renderAssistant();
    expect(screen.getByText('Ask about your shop')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Ask StockLoop' })).toBeInTheDocument();
  });

  it('shows a loading state while the question is answered', async () => {
    const gate = Promise.withResolvers<AiAskResponse>();
    vi.spyOn(api, 'ask').mockImplementation((input) => {
      expect(input.question).toBe('Do I reorder oat milk?');
      return gate.promise;
    });
    renderAssistant();
    await ask('Do I reorder oat milk?');
    expect(await screen.findByRole('status')).toHaveTextContent('Asking StockLoop…');
    gate.resolve(RESPONSE);
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
  });

  it('renders the answer with verified citations and an inert proposal', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue(RESPONSE);
    renderAssistant();
    await ask('How much oat milk is left?');
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
    const sources = screen.getByRole('list', { name: 'Source figures' });
    expect(sources).toHaveTextContent('products.PROD-001.stockQuantity = 12');
    expect(sources).toHaveTextContent('products.PROD-001.coverDays = 3');
    // Proposal is visibly a suggestion with current → proposed values, inert:
    expect(
      screen.getByRole('button', { name: 'Suggestion: Raise oat milk to 60 units' }),
    ).toBeInTheDocument();
    expect(screen.getByText('48 → 60')).toBeInTheDocument();
    expect(screen.getByText('Suggestions (not applied)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    expect(screen.getByText(RESPONSE.notice)).toBeInTheDocument();
  });

  it('offers a retry on provider error and recovers', async () => {
    vi.spyOn(api, 'ask')
      .mockRejectedValueOnce(new ApiError(502, 'Provider quota exceeded.'))
      .mockResolvedValueOnce(RESPONSE);
    renderAssistant();
    await ask('What needs restocking?');
    expect(await screen.findByText('We couldn’t answer that.')).toBeInTheDocument();
    expect(screen.getByText('Provider quota exceeded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
    expect(screen.queryByText('We couldn’t answer that.')).toBeNull();
    expect(vi.mocked(api.ask)).toHaveBeenCalledTimes(2);
  });

  it('renders a distinct refusal state', async () => {
    vi.spyOn(api, 'ask').mockRejectedValueOnce(
      new ApiError(502, 'The model refused the request.', { reason: 'refusal: safety policy' }),
    );
    renderAssistant();
    await ask('Tell me a story instead.');
    expect(await screen.findByText('The assistant declined to answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('restores the persisted conversation on a fresh mount (reload)', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue(RESPONSE);
    const first = renderAssistant();
    await ask('How much oat milk is left?');
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
    first.unmount();

    // Fresh ChatProvider over the same storage: history returns, no new request.
    renderAssistant();
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Source figures' })).toBeInTheDocument();
    await waitFor(() => expect(api.ask).toHaveBeenCalledTimes(1));
  });

  it('lists conversations with title, timestamp and active state; switching changes the view', async () => {
    seedPair();
    renderAssistant();

    const rowA = screen.getByRole('button', { name: /alpha/i });
    const rowB = screen.getByRole('button', { name: /beta/i });
    expect(rowA).toHaveAttribute('aria-current', 'true');
    expect(rowB).not.toHaveAttribute('aria-current', 'true');
    expect(rowA.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(Date.UTC(2024, 0, 2, 3, 4)).toISOString(),
    );

    await userEvent.click(rowB);
    expect(rowB).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByText('Ask about your shop')).toBeInTheDocument();
    expect(screen.queryByText(RESPONSE.answer)).not.toBeInTheDocument();

    await userEvent.click(rowA);
    expect(await screen.findByText(RESPONSE.answer)).toBeInTheDocument();
    expect(screen.queryByText('Ask about your shop')).not.toBeInTheDocument();
  });

  it('creates a conversation from the list header and persists both to storage', async () => {
    seedConversation('conv-seeded', 'Seeded');
    renderAssistant();

    await userEvent.click(screen.getByRole('button', { name: /^new chat$/i }));

    const stored = JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}');
    expect(stored.conversations).toHaveLength(2);
    expect(screen.getByText('Seeded')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renames a conversation inline and keeps storage in sync', async () => {
    seedPair();
    renderAssistant();

    const rowA = screen.getByRole('button', { name: /alpha/i }).closest('li')!;
    await userEvent.click(within(rowA).getByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText('Conversation title');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed{enter}');

    expect(screen.getByText('Renamed')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}') as {
      conversations: { id: string; title: string }[];
    };
    expect(stored.conversations.find((c) => c.id === 'conv-a')?.title).toBe('Renamed');
  });

  it('deletes via a two-step confirm that can be cancelled and then completed', async () => {
    seedPair();
    renderAssistant();

    const rowA = screen.getByRole('button', { name: /alpha/i }).closest('li')!;

    // Step 1: confirm mode replaces the row; Cancel reverts and keeps it.
    await userEvent.click(within(rowA).getByRole('button', { name: /^delete$/i }));
    expect(within(rowA).getByText('Delete this conversation?')).toBeInTheDocument();
    expect(within(rowA).getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(within(rowA).queryByRole('button', { name: /^rename$/i })).not.toBeInTheDocument();
    await userEvent.click(within(rowA).getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    // Step 2: re-enter confirm (re-queried after the remount) and commit.
    await userEvent.click(within(rowA).getByRole('button', { name: /^delete$/i }));
    await userEvent.click(within(rowA).getByRole('button', { name: /^delete$/i }));

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}');
    expect(stored.conversations).toHaveLength(1);
    expect(stored.conversations[0].id).toBe('conv-b');
  });

  it('persists a new conversation across a provider remount', async () => {
    const first = renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /^new chat$/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(
      JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}').conversations,
    ).toHaveLength(1);

    first.unmount();
    renderAssistant();

    expect(screen.getByText('New conversation')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}').conversations,
    ).toHaveLength(1);
  });

  it('reaches row select, Rename and Delete by keyboard; Escape cancels rename', async () => {
    seedPair();
    renderAssistant();

    const rowA = screen.getByRole('button', { name: /alpha/i }).closest('li')!;
    const selectBtn = within(rowA).getByRole('button', { name: /alpha/i }) as HTMLButtonElement;
    selectBtn.focus();
    expect(document.activeElement).toBe(selectBtn);
    await userEvent.tab();
    expect(document.activeElement).toBe(within(rowA).getByRole('button', { name: /^rename$/i }));
    await userEvent.tab();
    expect(document.activeElement).toBe(within(rowA).getByRole('button', { name: /^delete$/i }));

    await userEvent.click(within(rowA).getByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText('Conversation title') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Conversation title')).not.toBeInTheDocument();
    expect(within(rowA).getByRole('button', { name: /^rename$/i })).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('stockloop.chat.v1') ?? '{}') as {
      conversations: { id: string; title: string }[];
    };
    expect(stored.conversations.find((c) => c.id === 'conv-a')?.title).toBe('Alpha');
  });

  it('renders an empty state when storage has no conversations', () => {
    renderAssistant();
    expect(screen.getByText('No conversations yet — start one with New chat.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^new chat$/i })).toBeInTheDocument();
  });
});

function seedConversation(
  id: string,
  title: string,
  messages: ChatConversation['messages'] = [],
): ChatConversation {
  const conversation: ChatConversation = {
    id,
    title,
    createdAt: Date.UTC(2024, 0, 1),
    updatedAt: Date.UTC(2024, 0, 2, 3, 4),
    messages,
  };
  saveConversation(conversation);
  setCurrentConversation(id);
  return conversation;
}

/** Two conversations: A holds an answer, B is empty. */
function seedPair(): { idA: string; idB: string } {
  seedConversation('conv-a', 'Alpha', [
    { id: 'm1', role: 'user', content: 'How much oat milk is left?', createdAt: Date.now() },
    { id: 'm2', role: 'assistant', content: RESPONSE.answer, createdAt: Date.now() },
  ]);
  seedConversation('conv-b', 'Beta');
  setCurrentConversation('conv-a');
  return { idA: 'conv-a', idB: 'conv-b' };
}
