import type { Money } from '@/lib/api';

/**
 * Money is stored as integer minor units plus an ISO currency — never a float.
 * Fixtures use USD cents (38400 = $384.00).
 */
export function usd(amountMinor: number): Money {
  return { amountMinor, currency: 'USD' };
}

/** Fractional digits the currency actually uses (USD 2, JPY 0, KWD 3). */
function minorUnitDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function formatMoney(money: Money): string {
  const value = money.amountMinor / 10 ** minorUnitDigits(money.currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(value);
}
