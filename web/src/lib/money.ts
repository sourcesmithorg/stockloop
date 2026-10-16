import type { DecimalString } from '@/lib/api';

/**
 * Money arrives from the backend as an exact decimal string plus an ISO
 * currency ("2.50" + "USD"). Formatting to localized display text is the only
 * place a float is involved; arithmetic, totals and budgets stay server-side.
 * Currencies are never combined — every call carries its own currency.
 */
export function formatMoney(value: DecimalString, currency: string): string {
  // Guard: Number('') === 0 is finite — a blank amount would otherwise render
  // as a fabricated $0.00. An amount that is not a real decimal never becomes
  // a number; it falls back like unparseable input ('n/a USD').
  if (value.trim() === '') return `Unknown ${currency}`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${value} ${currency}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(parsed);
}

/** Money + explicit ISO code ("$240.00 USD") for document totals. */
export function formatMoneyWithCode(value: DecimalString, currency: string): string {
  return `${formatMoney(value, currency)} ${currency}`;
}

/**
 * Quantity display: keeps the backend's exact decimal text ("12", "2.79") —
 * never re-rounded, never coerced to a number that could turn unknown into 0.
 */
export function formatQuantity(value: DecimalString, unit?: string): string {
  return unit ? `${value} ${unit}` : value;
}
