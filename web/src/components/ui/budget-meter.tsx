import { formatMoney } from '@/lib/money';

export interface BudgetMeterProps {
  /** Already spent/selected in this currency (minor units). */
  totalMinor: number;
  budgetMinor: number;
  currency: string;
  /** Explicit treatment note — excluded tax/shipping is not zero cost. */
  excludedNote?: string;
  className?: string;
}

/**
 * `.budget-meter`: bar plus a full text summary — usable without color, and
 * totals stay per currency (never one mixed-currency number).
 */
export function BudgetMeter({
  totalMinor,
  budgetMinor,
  currency,
  excludedNote = 'Tax and shipping excluded.',
  className,
}: BudgetMeterProps) {
  const pct = budgetMinor > 0 ? Math.min(100, (totalMinor / budgetMinor) * 100) : 0;
  const remaining = budgetMinor - totalMinor;
  return (
    <div className={className} data-slot="budget-meter">
      <div className="budget-meter">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small muted">
        {formatMoney({ amountMinor: totalMinor, currency })} of{' '}
        {formatMoney({ amountMinor: budgetMinor, currency })} budget (
        {`${Math.round(pct * 10) / 10}%`});{' '}
        {remaining >= 0
          ? `${formatMoney({ amountMinor: remaining, currency })} left`
          : `${formatMoney({ amountMinor: -remaining, currency })} over budget — no silent cuts`}
        . {excludedNote}
      </p>
    </div>
  );
}
