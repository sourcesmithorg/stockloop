import type { DecimalString } from '@/lib/api';
import { formatMoney } from '@/lib/money';

export interface BudgetMeterProps {
  /** Selected total in this currency (server-computed; never mixed). */
  selectedTotal: DecimalString;
  /** null = no budget on record for this currency — unknown, never zero. */
  budgetAmount: DecimalString | null;
  currency: string;
  /** Explicit treatment note — excluded tax/shipping is not zero cost. */
  excludedNote?: string;
  className?: string;
}

/**
 * `.budget-meter`: bar plus a full text summary — usable without color, and
 * totals stay per currency (never one mixed-currency number). Without a
 * budget the utilization is honestly "unknown", not 0%.
 */
export function BudgetMeter({
  selectedTotal,
  budgetAmount,
  currency,
  excludedNote = 'Tax and shipping excluded.',
  className,
}: BudgetMeterProps) {
  if (budgetAmount === null) {
    return (
      <div className={className} data-slot="budget-meter">
        <p className="small muted">
          No budget is set for {currency} — utilization is unknown, not zero. {excludedNote}
        </p>
      </div>
    );
  }
  const total = Number(selectedTotal);
  const budget = Number(budgetAmount);
  const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const remaining = budget - total;
  return (
    <div className={className} data-slot="budget-meter">
      <div
        aria-label={`${currency} budget: ${formatMoney(selectedTotal, currency)} of ${formatMoney(budgetAmount, currency)}`}
        aria-valuemax={budget}
        aria-valuemin={0}
        aria-valuenow={total}
        className="budget-meter"
        role="meter"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small muted">
        {formatMoney(selectedTotal, currency)} of {formatMoney(budgetAmount, currency)} budget (
        {`${Math.round(pct * 10) / 10}%`});{' '}
        {remaining >= 0
          ? `${formatMoney(String(remaining), currency)} left`
          : `${formatMoney(String(-remaining), currency)} over budget — no silent cuts`}
        . {excludedNote}
      </p>
    </div>
  );
}
