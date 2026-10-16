import type { InventoryRiskView, RiskState } from '@/lib/api';

/**
 * Risk-view cell text. Unknown is a distinct word — never 0, never a dash.
 * Verified zero demand renders as a real "0 / day", separate from "No history".
 */

export function onHandText(risk: InventoryRiskView): string {
  return risk.stock.kind === 'known' ? `${risk.stock.value} ${risk.stock.unit}` : 'Unknown';
}

export function dailySalesText(risk: InventoryRiskView): string {
  if (risk.sales.kind === 'missing') return 'No history';
  if (risk.sales.kind === 'zeroVerified') return '0 / day';
  return `${risk.averageDailyDemand.kind === 'known' ? risk.averageDailyDemand.value : '—'} / day`;
}

export function leadText(risk: InventoryRiskView): string {
  if (risk.leadTime.kind !== 'known') return 'Unknown';
  return `${risk.leadTime.value} days`;
}

export function coverText(risk: InventoryRiskView): string {
  switch (risk.coverDays.kind) {
    case 'finite':
      return `${risk.coverDays.value} days`;
    case 'noRecentSales':
      return 'Not estimated';
    default:
      return 'Unavailable';
  }
}

/** Tone for the cover bar: a delivery gap is bad; thin cover without a gap warns. */
export function coverTone(risk: InventoryRiskView): 'good' | 'warn' | 'bad' {
  if (risk.deliveryGap.kind === 'finite' && Number(risk.deliveryGap.value) > 0) return 'bad';
  if (risk.coverDays.kind === 'finite' && Number(risk.coverDays.value) < 7) return 'warn';
  return 'good';
}

/** Severity-first ordering for priority tables (worst at the top). */
export const RISK_ORDER: Record<RiskState, number> = {
  outOfStock: 0,
  atRisk: 1,
  runningLow: 2,
  stale: 3,
  dataNeeded: 4,
  noRecentSales: 5,
  healthy: 6,
};

/** States a human would call "needs a restock look". */
export const ATTENTION_STATES: RiskState[] = ['outOfStock', 'atRisk', 'runningLow', 'stale'];

/** Backend delivery estimates are always unconfirmed calendar bounds. */
export function deliveryEstimateText(risk: InventoryRiskView): string {
  if (risk.deliveryEstimate.kind === 'unavailable') return 'Unavailable';
  const date = formatDate(risk.deliveryEstimate.date);
  return risk.deliveryEstimate.confirmed ? date : `${date} (estimated)`;
}

/** ISO date → "Oct 13, 2026" (UTC calendar day, no timezone drift). */
export function formatDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

/** ISO datetime → "Oct 13, 2026 · 09:10". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${day} · ${time}`;
}
