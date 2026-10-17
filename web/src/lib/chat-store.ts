import type { AiAskResponse, AiCitation, AiProposal } from './api';

/**
 * Display-only conversation history persisted per-browser in localStorage.
 * Not synced across devices and never sent back to the server: each turn posts
 * only the user's new question to POST /api/ai/ask, and restored messages are
 * rendered history the backend never trusts.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  proposals?: AiProposal[];
  notice?: string;
  error?: string;
  refusal?: boolean;
  createdAt: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

interface ChatDocument {
  conversations: ChatConversation[];
  currentId: string | null;
}

const STORAGE_KEY = 'stockloop.chat.v1';

function emptyDocument(): ChatDocument {
  return { conversations: [], currentId: null };
}

function readDocument(): ChatDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDocument();
    const parsed = JSON.parse(raw) as Partial<ChatDocument>;
    if (!Array.isArray(parsed.conversations)) return emptyDocument();
    return {
      conversations: parsed.conversations,
      currentId: typeof parsed.currentId === 'string' ? parsed.currentId : null,
    };
  } catch {
    // Corrupt or unavailable storage: start empty rather than crashing the app.
    return emptyDocument();
  }
}

function writeDocument(document: ChatDocument): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  } catch {
    // Quota/blocked storage: the session stays in memory for this page view.
  }
}

export function loadChatDocument(): ChatDocument {
  return readDocument();
}

export function newMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createConversation(): ChatConversation {
  const now = Date.now();
  const conversation: ChatConversation = {
    id: newConversationId(),
    title: 'New conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const document = readDocument();
  document.conversations.unshift(conversation);
  document.currentId = conversation.id;
  writeDocument(document);
  return conversation;
}

export function saveConversation(conversation: ChatConversation): void {
  const document = readDocument();
  const index = document.conversations.findIndex((item) => item.id === conversation.id);
  if (index === -1) document.conversations.unshift(conversation);
  else document.conversations[index] = conversation;
  writeDocument(document);
}

export function deleteConversation(id: string): void {
  const document = readDocument();
  document.conversations = document.conversations.filter((item) => item.id !== id);
  if (document.currentId === id) document.currentId = document.conversations[0]?.id ?? null;
  writeDocument(document);
}

export function setCurrentConversation(id: string | null): void {
  const document = readDocument();
  document.currentId = id;
  writeDocument(document);
}

/** Turns an /ai/ask success response into a stored assistant message. */
export function answerToMessage(id: string, answer: AiAskResponse): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: answer.answer,
    citations: answer.citations,
    proposals: answer.proposals,
    notice: answer.notice,
    createdAt: Date.now(),
  };
}
