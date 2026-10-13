import type { ReactNode } from 'react';

import { Icon } from '@/components/layout/icon';
import { cn } from '@/lib/cn';

export type NoteTone = 'neutral' | 'info' | 'warn' | 'bad' | 'good';

const TONE_CLASSES: Record<NoteTone, string> = {
  neutral: '',
  info: 'info',
  warn: 'warn',
  bad: 'bad',
  good: 'good',
};

const TONE_ICONS: Record<NoteTone, string> = {
  neutral: 'i-info',
  info: 'i-info',
  warn: 'i-warn',
  bad: 'i-warn',
  good: 'i-check-circle',
};

export interface InlineNoteProps {
  tone?: NoteTone;
  icon?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Inline contextual feedback (`.inline-note`). Errors stay beside the affected
 * action; use a toast/global notice only for genuinely global effects.
 */
export function InlineNote({
  tone = 'neutral',
  icon,
  title,
  children,
  className,
}: InlineNoteProps) {
  return (
    <div className={cn('inline-note', TONE_CLASSES[tone], className)}>
      <Icon name={icon ?? TONE_ICONS[tone]} />
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
