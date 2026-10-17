import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChatProvider } from '@/lib/chat';
import { api, type AiAskResponse } from '@/lib/api';
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
});
