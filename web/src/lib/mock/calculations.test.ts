import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import {
  FIXTURE_BUDGET_MINOR,
  OAT_MILK,
  OAT_MILK_RAW_REQUIRED,
  OAT_MILK_SALES_13D,
  OAT_MILK_SUGGESTED_UNITS,
  PACK_MOQ_CASE,
  PLAN_LINE_INPUTS,
  mockApi,
  remainingMinor,
  sumMinor,
  utilizationPercent,
} from '@/lib/mock';

import { averageUnits, coverDays, lineTotalMinor, suggestUnits } from './calculations';

describe('acceptance fixture arithmetic (T-11 … T-14)', () => {
  const lineTotals = PLAN_LINE_INPUTS.map((line) =>
    lineTotalMinor(line.suggestedBaseUnits, line.unitCostMinor),
  );

  it('sums to 384.00 USD and 222 base units', () => {
    expect(sumMinor(lineTotals)).toBe(38_400);
    expect(sumMinor(PLAN_LINE_INPUTS.map((line) => line.suggestedBaseUnits))).toBe(222);
    expect(formatMoney({ amountMinor: sumMinor(lineTotals), currency: 'USD' })).toBe('$384.00');
  });

  it('matches the four line totals exactly', () => {
    expect(lineTotals).toEqual([12_000, 12_000, 7_200, 7_200]);
  });

  it('groups 240.00 to Freshfield and 144.00 to Daily Goods', () => {
    const bySupplier = new Map<string, number>();
    PLAN_LINE_INPUTS.forEach((line, index) => {
      bySupplier.set(line.supplierId, (bySupplier.get(line.supplierId) ?? 0) + lineTotals[index]);
    });
    expect(bySupplier.get('SUP-001')).toBe(24_000);
    expect(bySupplier.get('SUP-002')).toBe(14_400);
  });

  it('keeps budget: 500.00 total, 116.00 remaining, 76.8% used', () => {
    const total = sumMinor(lineTotals);
    expect(FIXTURE_BUDGET_MINOR).toBe(50_000);
    expect(remainingMinor(total, FIXTURE_BUDGET_MINOR)).toBe(11_600);
    expect(utilizationPercent(total, FIXTURE_BUDGET_MINOR)).toBe(76.8);
  });
});

describe('oat milk fixture (T-11)', () => {
  it('derives 44 raw required → 48 units (4 packs)', () => {
    expect(OAT_MILK_RAW_REQUIRED).toBe(44);
    expect(OAT_MILK_SUGGESTED_UNITS).toBe(48);
    expect(OAT_MILK_SUGGESTED_UNITS % OAT_MILK.packUnits).toBe(0);
    expect(lineTotalMinor(OAT_MILK_SUGGESTED_UNITS, OAT_MILK.unitCostMinor)).toBe(12_000);
  });

  it('shows 3 days of cover for 12 stock at 4/day', () => {
    expect(coverDays(OAT_MILK.stock, OAT_MILK.demandPerDay)).toEqual({ kind: 'finite', days: 3 });
  });

  it('charts 13 days Sep 30–Oct 12 totalling 52 units, average 4', () => {
    expect(OAT_MILK_SALES_13D).toHaveLength(13);
    expect(sumMinor([...OAT_MILK_SALES_13D])).toBe(52);
    expect(averageUnits([...OAT_MILK_SALES_13D])).toBe(4);
  });
});

describe('pack/MOQ rounding (T-13)', () => {
  it('rounds demand 17 with pack 12 and MOQ 24 to 24 units, 7 excess', () => {
    const units = suggestUnits(
      PACK_MOQ_CASE.rawDemand,
      PACK_MOQ_CASE.packUnits,
      PACK_MOQ_CASE.minOrderUnits,
    );
    expect(units).toBe(24);
    expect(units / PACK_MOQ_CASE.packUnits).toBe(2);
    expect(units - PACK_MOQ_CASE.rawDemand).toBe(7);
  });

  it('never creates an MOQ-only order when demand is zero', () => {
    expect(suggestUnits(0, PACK_MOQ_CASE.packUnits, PACK_MOQ_CASE.minOrderUnits)).toBe(0);
  });
});

describe('zero and missing sales are states, not math errors', () => {
  it('yields noRecentSales instead of dividing by zero', () => {
    expect(coverDays(40, 0)).toEqual({ kind: 'noRecentSales' });
  });

  it('flags invalid inputs as unavailable rather than NaN/Infinity', () => {
    expect(coverDays(Number.NaN, 4).kind).toBe('unavailable');
    expect(coverDays(12, -1).kind).toBe('unavailable');
  });

  it('serves a noRecentSales product and a dataNeeded product from the mock API', async () => {
    const risk = await mockApi.getInventoryRisk();
    const tea = risk.find((item) => item.productId === 'PROD-TEA');
    const soap = risk.find((item) => item.productId === 'PROD-SOAP');
    expect(tea?.riskState).toBe('noRecentSales');
    expect(tea?.coverDays).toEqual({ kind: 'noRecentSales' });
    expect(tea?.sales.kind).toBe('zeroVerified');
    expect(soap?.riskState).toBe('dataNeeded');
    expect(soap?.stock.kind).toBe('unknown');
    expect(soap?.sales.kind).toBe('missing');
  });
});

describe('mock API contract', () => {
  it('serves the fixture plan with valid totals', async () => {
    const plan = await mockApi.getPlan('PLAN-001');
    expect(plan.budgets[0]).toMatchObject({
      totalMinor: 38_400,
      budgetMinor: 50_000,
      remainingMinor: 11_600,
      utilizationPercent: 76.8,
      taxIncluded: false,
      shippingIncluded: false,
    });
    expect(plan.lines).toHaveLength(4);
  });

  it('rejects unknown ids with 404 so not-found screens can render', async () => {
    await expect(mockApi.getPlan('PLAN-404')).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<ApiError>);
  });

  it('labels its explanation as rule-based, never fake AI', async () => {
    const answer = await mockApi.explain({ question: 'Why oat milk?' });
    expect(answer.source).toBe('rule-based');
    expect(answer.model).toBeNull();
  });
});
