import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHead } from '@/components/layout/page-head';
import {
  Button,
  EmptyState,
  ErrorNote,
  InlineNote,
  LoadingRows,
  Select,
  Textarea,
} from '@/components/ui';
import { useChat } from '@/lib/chat';
import type { ChatMessage } from '@/lib/chat-store';
import { usePageTitle } from '@/lib/use-page-title';

/**
 * Ask StockLoop — the full-screen chat surface, opened from the nav or the
 * minimized box, never the home screen (AGENTS.md: deterministic validation is
 * authoritative; model output is advisory). Every figure in an answer comes
 * from the server-assembled snapshot; proposals are inert drafts and nothing on
 * this screen mutates state. Conversation history is local display history only.
 */
export function AssistantPage() {
  usePageTitle('Assistant');
  const { conversations, current, busy, send, retryLast, newConversation, switchTo } = useChat();
  const [draft, setDraft] = useState('');
  const messages = current?.messages ?? [];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    void send(text);
  };

  return (
    <>
      <PageHead
        actions={
          <>
            {conversations.length > 1 && (
              <Select
                aria-label="Conversations"
                value={current?.id ?? ''}
                onChange={(event) => switchTo(event.target.value)}
              >
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </option>
                ))}
              </Select>
            )}
            <Button type="button" onClick={newConversation}>
              New conversation
            </Button>
          </>
        }
        description="Answers come from your store snapshot only — every figure is traced to its source, invented numbers are rejected, and nothing here changes your data."
        eyebrow="Advisory"
        title="Ask StockLoop"
      />

      {messages.length === 0 ? (
        <EmptyState icon="i-help" title="Ask about your shop">
          Stock levels, restock suggestions, budgets or suppliers. Every number in the reply is
          traced to your store snapshot; anything the model cannot verify comes back as an error.
        </EmptyState>
      ) : (
        <ol aria-label="Conversation" className="stack mt-16">
          {messages.map((message) => (
            <ConversationMessage
              key={message.id}
              message={message}
              onRetry={() => void retryLast()}
            />
          ))}
        </ol>
      )}

      {busy && <LoadingRows label="Asking StockLoop…" />}

      <form className="mt-16" onSubmit={onSubmit}>
        <Textarea
          aria-label="Your question"
          id="assistant-question"
          placeholder="e.g. Do I need to reorder oat milk?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <span className="row mt-8">
          <Button disabled={busy || !draft.trim()} type="submit" variant="primary">
            Ask StockLoop
          </Button>
        </span>
      </form>
    </>
  );
}

function ConversationMessage({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  if (message.role === 'user') {
    return (
      <li aria-label="Your question">
        <p className="strong">{message.content}</p>
      </li>
    );
  }

  if (message.refusal) {
    return (
      <li aria-label="Assistant reply">
        <InlineNote icon="i-warn" tone="bad" title="The assistant declined to answer.">
          StockLoop only answers from your store data — and the model declined here. Try rephrasing;
          nothing was changed either way.
          <span className="row mt-8">
            <Button size="sm" type="button" onClick={onRetry}>
              Retry
            </Button>
          </span>
        </InlineNote>
      </li>
    );
  }

  if (message.error) {
    return (
      <li aria-label="Assistant reply">
        <ErrorNote
          error={new Error(message.error)}
          title="We couldn’t answer that."
          onRetry={onRetry}
        />
      </li>
    );
  }

  return (
    <li aria-label="Assistant reply">
      <p>{message.content}</p>
      {message.citations && message.citations.length > 0 && (
        <ul aria-label="Source figures" className="mt-8">
          {message.citations.map((citation) => (
            <li key={citation.field}>
              <code>{citation.field}</code> = {citation.value}
            </li>
          ))}
        </ul>
      )}
      {message.proposals && message.proposals.length > 0 && (
        <section aria-label="Draft suggestions" className="mt-12">
          <h2>Suggestions (not applied)</h2>
          {message.proposals.map((proposal) => (
            <div key={proposal.field} className="mt-8">
              <dl className="mt-4">
                <dt>{proposal.field}</dt>
                <dd>
                  {proposal.currentValue} → {proposal.proposedValue}
                </dd>
              </dl>
              <Button aria-label={`Suggestion: ${proposal.title}`} type="button" variant="ghost">
                Suggestion — {proposal.title}
              </Button>
            </div>
          ))}
        </section>
      )}
      {message.notice && <p className="small muted mt-8">{message.notice}</p>}
    </li>
  );
}
