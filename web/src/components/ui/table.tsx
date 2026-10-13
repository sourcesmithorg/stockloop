import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface TableProps {
  /** Accessible name for the scroll region — what screen readers announce. */
  label: string;
  /** Semantic <caption>; required. Pass captionVisible={false} to hide it. */
  caption: string;
  captionVisible?: boolean;
  /** Keep tables scrolling inside this region; the page never widens. */
  minWidth?: number | string;
  className?: string;
  children: ReactNode;
}

/**
 * Labeled, keyboard-focusable scroll region around a semantic data table
 * (`.table-scroll` + `.data-table` from cornerstore.css). Headers use
 * `scope="col"` / `scope="row"` in the caller; numeric cells take `.num`.
 */
export function Table({
  label,
  caption,
  captionVisible = true,
  minWidth,
  className,
  children,
}: TableProps) {
  return (
    <div
      aria-label={label}
      className={cn('table-scroll', className)}
      role="region"
      tabIndex={0}
      data-slot="table-region"
    >
      <table className="data-table" style={minWidth ? { minWidth } : undefined}>
        <caption className={captionVisible ? undefined : 'sr-only'}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
