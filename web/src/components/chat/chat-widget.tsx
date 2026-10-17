import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';

import { Icon } from '@/components/layout/icon';
import { buttonClass } from '@/components/ui';
import { useChat } from '@/lib/chat';

/**
 * Minimized chat box on every routed page except the full-screen chat itself.
 * Keeps the current conversation visible so the user can carry on: expand goes
 * to /assistant, the close control collapses it to a small dock button that
 * reopens it. Plain buttons and a link in normal document order — focus is
 * never trapped; hidden below the md breakpoint so it cannot cover narrow
 * (390/320) content; no animation, so prefers-reduced-motion is respected.
 */
export function ChatWidget() {
  const { pathname } = useLocation();
  const { current, minimized, setMinimized } = useChat();
  const dockRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  if (pathname === '/assistant') return null;
  if (!current || current.messages.length === 0) return null;

  const last = current.messages[current.messages.length - 1];
  const snippet = last.content.slice(0, 140);

  if (!minimized) {
    return (
      <div className="fixed right-4 bottom-4 z-40">
        <button
          ref={dockRef}
          aria-label="Open minimized chat"
          className={buttonClass('primary', 'sm')}
          type="button"
          onClick={() => {
            flushSync(() => setMinimized(true));
            boxRef.current?.focus();
          }}
        >
          <Icon name="i-spark" />
          Chat · {current.title}
        </button>
      </div>
    );
  }

  return (
    <aside
      ref={boxRef}
      aria-label="Minimized chat"
      tabIndex={-1}
      className="fixed right-4 bottom-4 z-40 hidden w-80 max-w-[calc(100vw-2rem)] flex-col rounded-sm border border-border bg-surface shadow-lg md:flex"
      data-component="chat-minimized"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <strong className="truncate text-sm">Chat · {current.title}</strong>
        <button
          aria-label="Minimize chat"
          className="shrink-0 rounded-sm p-1 hover:bg-soft focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary"
          type="button"
          onClick={() => {
            flushSync(() => setMinimized(false));
            dockRef.current?.focus();
          }}
        >
          <Icon name="i-close" />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="muted line-clamp-3 text-sm" title={last.content}>
          {last.role === 'user' ? 'You: ' : ''}
          {snippet}
          {last.content.length > 140 ? '…' : ''}
        </p>
      </div>
      <div className="px-4 pb-3">
        <Link aria-label="Continue chat" className={buttonClass('secondary', 'sm')} to="/assistant">
          Continue chat
        </Link>
      </div>
    </aside>
  );
}
