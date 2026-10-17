import { afterEach, describe, expect, it } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChatProvider } from '@/lib/chat';

import { ChatWidget } from './chat-widget';

const STORAGE_KEY = 'stockloop.chat.v1';

function seedConversation() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      conversations: [
        {
          id: 'conv-1',
          title: 'Oat milk',
          createdAt: 1,
          updatedAt: 2,
          messages: [
            { id: 'm1', role: 'user', content: 'Do I need to reorder oat milk?', createdAt: 1 },
            {
              id: 'm2',
              role: 'assistant',
              content: 'Oat milk has 12 on hand with 3 days of cover.',
              createdAt: 2,
            },
          ],
        },
      ],
      currentId: 'conv-1',
    }),
  );
}

function renderWidget(path = '/overview') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChatProvider>
        <ChatWidget />
      </ChatProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('minimized chat box', () => {
  it('keeps the conversation visible and collapses to a dock button', async () => {
    seedConversation();
    renderWidget();
    const box = screen.getByRole('complementary', { name: 'Minimized chat' });
    expect(box).toHaveTextContent('Oat milk has 12 on hand with 3 days of cover.');
    expect(screen.getByRole('link', { name: 'Continue chat' })).toHaveAttribute(
      'href',
      '/assistant',
    );
    // Collapse: box hides, dock button reopens it — plain buttons, no focus trap.
    await userEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));
    expect(screen.queryByRole('complementary', { name: 'Minimized chat' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open minimized chat' }));
    expect(screen.getByRole('complementary', { name: 'Minimized chat' })).toBeInTheDocument();
  });

  it('stays out of the way on the chat route itself', () => {
    seedConversation();
    renderWidget('/assistant');
    expect(screen.queryByRole('complementary', { name: 'Minimized chat' })).toBeNull();
  });

  it('shows nothing before the first question', () => {
    renderWidget();
    expect(screen.queryByRole('complementary', { name: 'Minimized chat' })).toBeNull();
  });

  it('reaches the minimize control by keyboard alone', async () => {
    seedConversation();
    renderWidget();
    const minimize = screen.getByRole('button', { name: 'Minimize chat' });
    minimize.focus();
    expect(document.activeElement).toBe(minimize);
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Minimized chat' })).toBeNull(),
    );
    const dock = screen.getByRole('button', { name: 'Open minimized chat' });
    expect(document.activeElement).toBe(dock);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('complementary', { name: 'Minimized chat' })).toBeInTheDocument();
  });
});
