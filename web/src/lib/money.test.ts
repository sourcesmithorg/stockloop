import { describe, expect, it } from 'vitest';

import { formatMoney, formatMoneyWithCode, formatQuantity } from './money';

/**
 * Money formatting contract: decimal strings in, currency-scaled text out.
 * The domain invariant is "prices, totals and budgets retain currency and
 * precision" — a wrong scale or a dropped currency is user-visible.
 */

describe('formatMoney (decimal string + ISO currency → display text)', () => {
  it('renders each currency at its own decimal scale', () => {
    // JPY uses 0 decimals: no phantom ".00" appended to a yen amount.
    expect(formatMoney('384', 'JPY')).toBe('¥384');
    // Fractional input is rounded to the currency scale, not truncated.
    expect(formatMoney('384.7', 'JPY')).toBe('¥385');
    // USD keeps exactly 2 decimals.
    expect(formatMoney('384.00', 'USD')).toBe('$384.00');
    // A 3-decimal currency (KWD) keeps 3 — scale comes from the currency code.
    expect(formatMoney('2.500', 'KWD')).toContain('2.500');
  });

  it('preserves the decimal-string amount at display scale', () => {
    expect(formatMoney('144.00', 'USD')).toBe('$144.00'); // trailing zeros kept
    expect(formatMoney('2.79', 'USD')).toBe('$2.79'); // no float mangling
    // More precision than the display scale: rounded (12.35), never
    // truncated to 12.34 — half-cent losses would accumulate silently.
    expect(formatMoney('12.347', 'USD')).toBe('$12.35');
    // A present zero renders as a real zero amount — it is data, not absence.
    expect(formatMoney('0', 'USD')).toBe('$0.00');
  });

  it('always renders with its own currency — never a bare number', () => {
    const usd = formatMoney('240.00', 'USD');
    expect(usd).toBe('$240.00');
    expect(usd).not.toBe('240.00');
    // The same amount in another currency renders differently: the currency
    // argument is never ignored, so a value cannot masquerade as another one.
    expect(formatMoney('240.00', 'EUR')).toBe('€240.00');
    // Document totals add the explicit ISO code ("$240.00 USD").
    expect(formatMoneyWithCode('240.00', 'USD')).toBe('$240.00 USD');
    expect(formatMoneyWithCode('144.00', 'USD')).toBe('$144.00 USD');
  });

  it('falls back to raw value + currency when the amount is not a number', () => {
    // An unparseable amount is shown verbatim with its currency — never
    // silently rendered as $0.00 (unknown is not zero).
    expect(formatMoney('n/a', 'USD')).toBe('n/a USD');
    expect(formatMoney('unknown', 'EUR')).toBe('unknown EUR');
  });

  it('never lets an empty or whitespace-only amount become $0.00', () => {
    // Blank is unknown, "0" is a real measured zero — the distinction is the
    // whole point. Blank takes the same honest fallback shape as 'n/a USD'.
    expect(formatMoney('', 'USD')).not.toBe('$0.00');
    expect(formatMoney('', 'USD')).toBe('Unknown USD'); // deliberate word choice
    expect(formatMoney('   ', 'JPY')).not.toBe('¥0');
    expect(formatMoney('   ', 'JPY')).toBe('Unknown JPY');
    // A genuine zero still renders as zero.
    expect(formatMoney('0', 'USD')).toBe('$0.00');
  });
});

describe('formatQuantity (backend decimal text passthrough)', () => {
  it('passes the exact decimal text through without numeric coercion', () => {
    expect(formatQuantity('2.79')).toBe('2.79');
    expect(formatQuantity('12', 'each')).toBe('12 each');
    // Unknown markers survive as words — never parsed into a number, never 0.
    expect(formatQuantity('unknown')).toBe('unknown');
    expect(formatQuantity('Unavailable')).toBe('Unavailable');
  });
});
