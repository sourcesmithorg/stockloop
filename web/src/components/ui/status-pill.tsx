import type { RiskState } from '@/lib/api';
import { cn } from '@/lib/cn';

import { Icon } from '@/components/layout/icon';

export type PillTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'accent';

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: '',
  good: 'good',
  warn: 'warn',
  bad: 'bad',
  info: 'info',
  accent: 'accent',
};

export interface StatusPillProps {
  /** Text is mandatory — status never relies on color alone. */
  label: string;
  tone?: PillTone;
  /** Optional consistent icon, decorative beside the text. */
  icon?: string;
  className?: string;
}

export function StatusPill({ label, tone = 'neutral', icon, className }: StatusPillProps) {
  return (
    <span className={cn('pill', TONE_CLASSES[tone], className)}>
      {icon && <Icon name={icon} />}
      {label}
    </span>
  );
}

/** Risk enum → text. Distinct states; never merged into a vague good/bad. */
const RISK_TEXT: Record<RiskState, { label: string; tone: PillTone; icon: string }> = {
  outOfStock: { label: 'Out of stock', tone: 'bad', icon: 'i-warn' },
  atRisk: { label: 'At risk', tone: 'bad', icon: 'i-warn' },
  runningLow: { label: 'Running low', tone: 'warn', icon: 'i-clock' },
  healthy: { label: 'Healthy', tone: 'good', icon: 'i-check-circle' },
  noRecentSales: { label: 'No recent sales', tone: 'info', icon: 'i-info' },
  dataNeeded: { label: 'Data needed', tone: 'warn', icon: 'i-help' },
  stale: { label: 'Stale data', tone: 'warn', icon: 'i-refresh' },
};

export function RiskStatePill({ state, className }: { state: RiskState; className?: string }) {
  const text = RISK_TEXT[state];
  return <StatusPill className={className} icon={text.icon} label={text.label} tone={text.tone} />;
}
