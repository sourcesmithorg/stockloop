import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';

export interface CoverageBarProps {
  /** Days of cover; caller derives tone from business policy, not this component. */
  days: number;
  /** Reference horizon for the fill width (e.g. target + lead days). */
  max?: number;
  tone?: 'good' | 'warn' | 'bad';
  label?: string;
  className?: string;
}

/**
 * `.coverage` from cornerstore.css: text first, bar second — the number is
 * always readable, the color only reinforces it. Thresholds are the caller's
 * policy decision, never decided here by color.
 */
export function CoverageBar({ days, max = 14, tone = 'good', label, className }: CoverageBarProps) {
  const pct = Math.max(0, Math.min(100, (days / max) * 100));
  return (
    <p className={cn('coverage', tone, className)} data-slot="coverage">
      <span>
        {Number.isFinite(days) ? days : '—'} days of cover
        {label && <span className="text-muted"> · {label}</span>}
      </span>
      <i aria-hidden="true">
        <span style={{ '--fill': `${pct}%` } as CSSProperties} />
      </i>
    </p>
  );
}
