import type { ReactNode } from 'react';

import { Icon } from '@/components/layout/icon';
import { cn } from '@/lib/cn';

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  /** Start expanded (native <details open>; still toggles on keyboard/touch). */
  open?: boolean;
  /** Use for table-level "why this?" popovers inside rows. */
  table?: boolean;
}

/**
 * Native <details> disclosure — works on keyboard and touch by construction
 * (.docs/AGENTS.md: native disclosures must work on keyboard/touch). Content
 * is plain DOM, so expanded explanations stay accessible without hover.
 */
export function Disclosure({
  summary,
  children,
  className,
  open = false,
  table = false,
}: DisclosureProps) {
  return (
    <details
      className={cn(table ? 'table-disclosure' : 'disclosure', className)}
      // Uncontrolled: `open` only seeds the initial state, then the user owns it.
      {...(open ? { open: true } : {})}
    >
      <summary>
        {summary}
        <Icon className="sm" name="i-chevron" />
      </summary>
      <div className={cn(table ? undefined : 'disclosure-content', 'text-sm text-muted')}>
        {children}
      </div>
    </details>
  );
}
