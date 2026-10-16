import type { ReactNode } from 'react';

import { Icon } from '@/components/layout/icon';

import { Button } from './button';
import { InlineNote } from './inline-note';

/**
 * Loading state from .template/states.html: a spoken status line plus
 * decorative skeleton rows (aria-hidden, so screen readers get one message).
 */
export function LoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div>
      <div className="loading-status" role="status">
        <Icon name="i-clock" />
        <span>{label}</span>
      </div>
      <div aria-hidden="true" className="mt-16">
        {Array.from({ length: rows }, (_, index) => (
          <div className="skeleton-row" key={index}>
            <span className="skeleton thumb" />
            <span className="skeleton long" />
            <span className="skeleton short" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Honest empty state (never a fabricated zero): names what is missing and
 * offers the real next step.
 */
export function EmptyState({
  icon = 'i-box',
  title,
  children,
  actions,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/** API failure state: the server's message plus a retry that keeps context. */
export function ErrorNote({
  error,
  onRetry,
  title = 'We couldn’t load this data.',
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : 'Check your connection and try again.';
  return (
    <InlineNote tone="bad" title={title}>
      {message}
      <span className="row mt-8">
        <Button onClick={onRetry} size="sm" type="button">
          <Icon name="i-refresh" />
          Retry
        </Button>
      </span>
    </InlineNote>
  );
}
