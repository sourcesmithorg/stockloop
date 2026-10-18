import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Icon } from '@/components/layout/icon';
import { PageHead } from '@/components/layout/page-head';
import {
  Button,
  buttonClass,
  EmptyState,
  ErrorNote,
  InlineNote,
  Input,
  LoadingRows,
  Textarea,
} from '@/components/ui';
import { useChat } from '@/lib/chat';
import type { ChatConversation, ChatMessage } from '@/lib/chat-store';
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
  const {
    conversations,
    current,
    busy,
    send,
    retryLast,
    newConversation,
    switchTo,
    rename,
    remove,
  } = useChat();
  const [draft, setDraft] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const messages = current?.messages ?? [];

  // Attachment staged in memory only; the composer keeps it after a failed ask
  // (Retry re-sends it) and clears it on success — nothing is persisted.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (candidate: File | null) => {
    if (!candidate) return;
    const okType = /\.(txt|md|csv|json)$/i.test(candidate.name);
    const withinSize = candidate.size <= 204_800;
    if (!okType || !withinSize) {
      setFileError(
        "That file type isn't supported — attach .txt, .md, .csv or .json under 200 KB.",
      );
      return;
    }
    setFileError(null);
    setFile(candidate);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    void send(text, undefined, { file: file ?? undefined }).then((succeeded) => {
      // Success clears the chip; failure keeps it so Retry re-sends the file.
      if (succeeded) setFile(null);
    });
  };

  const startRename = (conversation: ChatConversation) => {
    setConfirmingId(null);
    setRenameDraft(conversation.title);
    setRenamingId(conversation.id);
  };

  const commitRename = (id: string) => {
    // Blank text and the 80-char cap are handled inside the store.
    rename(id, renameDraft);
    setRenamingId(null);
  };

  return (
    <>
      <PageHead
        description="Answers come from your store snapshot only — every figure is traced to its source, invented numbers are rejected, and nothing here changes your data."
        eyebrow="Advisory"
        title="Ask StockLoop"
      />

      <section aria-label="Conversations" className="mt-16">
        <div className="row between wrap">
          <p className="eyebrow">Conversations</p>
          <Button onClick={newConversation} type="button" variant="primary">
            <Icon name="i-plus" />
            New chat
          </Button>
        </div>

        {conversations.length === 0 ? (
          <p className="small muted mt-8">No conversations yet — start one with New chat.</p>
        ) : (
          <ul className="stack mt-8">
            {conversations.map((conversation) => {
              const title = conversation.title.trim() || 'Untitled conversation';
              const active = current?.id === conversation.id;

              if (renamingId === conversation.id) {
                return (
                  <li key={conversation.id}>
                    <form
                      className="row wrap"
                      onSubmit={(event) => {
                        event.preventDefault();
                        commitRename(conversation.id);
                      }}
                    >
                      <Input
                        aria-label="Conversation title"
                        autoFocus
                        className="grow"
                        maxLength={80}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Escape') return;
                          event.preventDefault();
                          setRenamingId(null);
                        }}
                      />
                      <Button size="sm" type="submit" variant="primary">
                        Save
                      </Button>
                      <Button onClick={() => setRenamingId(null)} size="sm" type="button">
                        Cancel
                      </Button>
                    </form>
                  </li>
                );
              }

              if (confirmingId === conversation.id) {
                return (
                  <li key={conversation.id}>
                    <div className="row wrap">
                      <span className="small muted">Delete this conversation?</span>
                      <Button
                        onClick={() => {
                          remove(conversation.id);
                          setConfirmingId(null);
                        }}
                        size="sm"
                        variant="danger"
                      >
                        Delete
                      </Button>
                      <Button onClick={() => setConfirmingId(null)} size="sm" type="button">
                        Cancel
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li className="row wrap" key={conversation.id}>
                  <button
                    aria-current={active ? 'true' : undefined}
                    className={buttonClass(
                      'ghost',
                      'md',
                      active
                        ? 'grow min-w-0 flex-col items-start border-border bg-soft text-left'
                        : 'grow min-w-0 flex-col items-start text-left',
                    )}
                    onClick={() => switchTo(conversation.id)}
                    type="button"
                  >
                    <span className="w-full truncate" title={title}>
                      {title}
                    </span>
                    <time
                      className="small muted"
                      dateTime={new Date(conversation.updatedAt).toISOString()}
                    >
                      {new Date(conversation.updatedAt).toLocaleString()}
                    </time>
                  </button>
                  <Button
                    onClick={() => startRename(conversation)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Icon name="i-edit" />
                    Rename
                  </Button>
                  <Button
                    onClick={() => {
                      setRenamingId(null);
                      setConfirmingId(conversation.id);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Icon name="i-trash" />
                    Delete
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
        {fileError && (
          <div className="mt-8">
            <InlineNote tone="bad">{fileError}</InlineNote>
          </div>
        )}
        {file && (
          <div className="mt-8">
            <span className="row">
              <span className="small muted">
                <Icon name="i-file" />
                <span className="truncate" style={{ maxWidth: '16rem' }} title={file.name}>
                  {file.name}
                </span>
                <span>{formatFileSize(file.size)}</span>
              </span>
              <Button
                aria-label={`Remove file ${file.name}`}
                onClick={() => {
                  setFile(null);
                  setFileError(null);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Icon name="i-close" />
                Remove
              </Button>
            </span>
            <div className="mt-8">
              <InlineNote>
                File contents are sent to the configured AI provider to answer your question — they
                do not stay in your browser, are not saved to your store, and are never written to
                your store data.
              </InlineNote>
            </div>
          </div>
        )}
        <span className="row mt-8">
          <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
            <Icon name="i-upload" />
            Attach file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            aria-label="Attach a file"
            className="hidden"
            onChange={onFileChange}
          />
          <Button disabled={busy || !draft.trim()} type="submit" variant="primary">
            Ask StockLoop
          </Button>
        </span>
      </form>
    </>
  );
}

/** One-decimal KB/MB chip label (12.3 KB, 1.0 MB). */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
