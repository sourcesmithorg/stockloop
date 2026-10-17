import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  answerToMessage,
  createConversation,
  loadChatDocument,
  newMessageId,
  saveConversation,
  setCurrentConversation,
  type ChatConversation,
} from '@/lib/chat-store';

/**
 * Chat session state shared by the full-screen /assistant surface and the
 * minimized box in the shell. Conversations persist per-browser in localStorage
 * (display history only — the server only ever receives the new question).
 */
export interface ChatContextValue {
  conversations: ChatConversation[];
  current: ChatConversation | null;
  busy: boolean;
  minimized: boolean;
  setMinimized(value: boolean): void;
  send(question: string, base?: ChatConversation): Promise<void>;
  retryLast(): Promise<void>;
  newConversation(): void;
  switchTo(id: string): void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function currentFromStorage(conversations: ChatConversation[]): ChatConversation | null {
  const document = loadChatDocument();
  if (document.currentId) {
    const found = conversations.find((item) => item.id === document.currentId);
    if (found) return found;
  }
  return conversations[0] ?? null;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadChatDocument().conversations, []);
  const [conversations, setConversations] = useState<ChatConversation[]>(initial);
  const [current, setCurrent] = useState<ChatConversation | null>(() =>
    currentFromStorage(initial),
  );
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(true);

  const persist = useCallback((next: ChatConversation) => {
    saveConversation(next);
    setConversations(loadChatDocument().conversations);
    setCurrent(next);
  }, []);

  const send = useCallback(
    async (question: string, base?: ChatConversation) => {
      const text = question.trim();
      if (!text || busy) return;
      setBusy(true);
      const conversation = base ?? current ?? createConversation();
      const now = Date.now();
      const withUser: ChatConversation = {
        ...conversation,
        title: conversation.messages.length === 0 ? text.slice(0, 60) : conversation.title,
        updatedAt: now,
        messages: [
          ...conversation.messages,
          { id: newMessageId(), role: 'user', content: text, createdAt: now },
        ],
      };
      persist(withUser);
      try {
        const answer = await api.ask({ question: text });
        persist({
          ...withUser,
          updatedAt: Date.now(),
          messages: [...withUser.messages, answerToMessage(newMessageId(), answer)],
        });
      } catch (error) {
        const refusal = error instanceof ApiError && (error.reason ?? '').startsWith('refusal');
        const message =
          error instanceof ApiError
            ? error.message
            : 'The assistant could not be reached. Nothing was changed.';
        persist({
          ...withUser,
          updatedAt: Date.now(),
          messages: [
            ...withUser.messages,
            {
              id: newMessageId(),
              role: 'assistant',
              content: refusal
                ? 'StockLoop only answers from your store data — and the model declined here.'
                : 'This question could not be answered.',
              refusal: refusal || undefined,
              error: message,
              createdAt: Date.now(),
            },
          ],
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, current, persist],
  );

  /** Re-asks after a failure: drops the failed exchange, then retries it. */
  const retryLast = useCallback(async () => {
    const conversation = current;
    if (!conversation || busy) return;
    const last = conversation.messages[conversation.messages.length - 1];
    const before = conversation.messages[conversation.messages.length - 2];
    if (last?.role !== 'assistant' || !last.error || before?.role !== 'user') return;
    const base = { ...conversation, messages: conversation.messages.slice(0, -2) };
    persist(base);
    await send(before.content, base);
  }, [busy, current, persist, send]);

  const newConversation = useCallback(() => {
    const created = createConversation();
    setConversations(loadChatDocument().conversations);
    setCurrent(created);
  }, []);

  const switchTo = useCallback((id: string) => {
    setCurrentConversation(id);
    const document = loadChatDocument();
    setConversations(document.conversations);
    setCurrent(document.conversations.find((item) => item.id === id) ?? null);
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      current,
      busy,
      minimized,
      setMinimized,
      send,
      retryLast,
      newConversation,
      switchTo,
    }),
    [conversations, current, busy, minimized, send, retryLast, newConversation, switchTo],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within <ChatProvider>');
  return context;
}
