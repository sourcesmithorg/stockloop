import type { CoverDaysValue } from '@/lib/api';

/*
 * Deterministic purchasing math — the proposed baseline formula from
 * .docs/CALCULATION-RULES.md. All functions validate their inputs: unknown or
 * invalid values must never silently become zero, NaN or Infinity.
 */

/** Gross target minus stock; never below zero. */
export function rawRequired(
  demandPerDay: number,
  stock: number,
  targetDays: number,
  leadDays: number,
  safetyDays: number,
): number {
  const values = [demandPerDay, stock, targetDays, leadDays, safetyDays];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('rawRequired: demand, stock and horizons must be finite and non-negative');
  }
  return Math.max(0, demandPerDay * (targetDays + leadDays + safetyDays) - stock);
}

/**
 * Round raw demand up to whole purchase packs, honoring the supplier MOQ —
 * but a zero raw requirement stays zero: MOQ alone never creates an order.
 */
export function suggestUnits(
  rawRequiredUnits: number,
  packUnits: number,
  minOrderUnits: number,
): number {
  if (!Number.isFinite(packUnits) || packUnits <= 0) {
    throw new Error('suggestUnits: pack size must be a positive number');
  }
  if (!Number.isFinite(minOrderUnits) || minOrderUnits < 0) {
    throw new Error('suggestUnits: MOQ must be finite and non-negative');
  }
  if (rawRequiredUnits <= 0) return 0;
  const minimum = Math.max(rawRequiredUnits, minOrderUnits);
  return packUnits * Math.ceil(minimum / packUnits);
}

/**
 * Days of cover. Verified zero sales is a real state (`noRecentSales`) — never
 * a division, never Infinity, never a fabricated "healthy".
 */
export function coverDays(stock: number, demandPerDay: number): CoverDaysValue {
  if (!Number.isFinite(demandPerDay) || demandPerDay < 0) {
    return { kind: 'unavailable', reason: 'Demand is not a valid value' };
  }
  if (demandPerDay === 0) {
    return { kind: 'noRecentSales' };
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return { kind: 'unavailable', reason: 'Stock is not a valid value' };
  }
  return { kind: 'finite', days: stock / demandPerDay };
}

/** Integer minor units in, integer minor units out — no floats in money math. */
export function lineTotalMinor(units: number, unitCostMinor: number): number {
  if (!Number.isInteger(units) || units < 0) {
    throw new Error('lineTotalMinor: units must be a non-negative whole number');
  }
  if (!Number.isInteger(unitCostMinor) || unitCostMinor < 0) {
    throw new Error('lineTotalMinor: unit cost must be non-negative minor units');
  }
  return units * unitCostMinor;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Per-currency budget math. Utilization keeps one decimal (76.8, not 76.80001). */
export function utilizationPercent(totalMinor: number, budgetMinor: number): number {
  if (!Number.isFinite(budgetMinor) || budgetMinor <= 0) {
    throw new Error('utilizationPercent: budget must be a positive amount');
  }
  return Math.round((totalMinor / budgetMinor) * 1000) / 10;
}

export function remainingMinor(totalMinor: number, budgetMinor: number): number {
  return budgetMinor - totalMinor;
}

export function averageUnits(dailyUnits: readonly number[]): number {
  if (dailyUnits.length === 0) {
    throw new Error('averageUnits: cannot average an empty window');
  }
  return sumMinor(dailyUnits) / dailyUnits.length;
}
