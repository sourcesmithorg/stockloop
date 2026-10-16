import type {
  Approval,
  InventoryRiskView,
  OrderDetail,
  OrderSummary,
  PlanDetail,
  PlanSummary,
  Product,
  SalesPoint,
  Supplier,
} from '@/lib/api';

/**
 * Demo fixtures — the same shape as api/app/schemas.py responses, pinned to
 * the acceptance-fixture date (2026-10-13) so tests are deterministic:
 *
 *   Oat milk      48 units (4 × 12) @ 2.50 = 120.00   at risk (3d cover, 5d lead)
 *   Jasmine rice  30 units (5 × 6)  @ 4.00 = 120.00   running low (MOQ applied)
 *   Noodles       96 units (4 × 24) @ 0.75 =  72.00   at risk (1-day delivery gap)
 *   Sparkling H2O 48 units (4 × 12) @ 1.50 =  72.00   running low
 *   Total        222 units                            384.00 USD
 *   Freshfield 240.00 + Daily Goods 144.00; budget 500.00; remaining 116.00;
 *   utilization 76.8%; tax/shipping EXCLUDED (not zero).
 *
 * Chamomile tea adds a verified-zero-sales state; all-purpose flour adds the
 * unknown-is-not-zero state (no stock, sales, terms or supplier on record).
 */

export const DEMO_DATE = { iso: '2026-10-13', label: 'Tuesday, October 13' } as const;

export const STORE = {
  id: 'STORE-001',
  name: 'Maple & Main',
  kind: 'Neighborhood market',
  currency: 'USD',
  locale: 'en',
  owner: { name: 'Jamie Lee', initials: 'JL', role: 'Store owner' },
  demo: true,
} as const;

export const POLICY_VERSION = '2026-10-13.v1';
const WINDOW = { start: '2026-09-30', end: '2026-10-12' } as const;
const STOCK_AS_OF = '2026-10-13';
const SNAPSHOT_ID = 'SNAP-2026-10-13';

// ---- Suppliers (SupplierOut) ----

export const SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    code: 'SUP-001',
    name: 'Freshfield Foods',
    contactEmail: 'supply@example.test',
    documentCurrency: 'USD',
    leadTimeDays: 5,
    // Mon-Fri regular delivery window (stated in the delivered fixture).
    deliveryDays: [0, 1, 2, 3, 4],
    calendarConfirmed: true,
    lastVerifiedAt: '2026-10-13',
    version: 1,
  },
  {
    id: 'SUP-002',
    code: 'SUP-002',
    name: 'Daily Goods Co.',
    contactEmail: 'orders@example.test',
    documentCurrency: 'USD',
    leadTimeDays: 3,
    // No delivery calendar on record: estimates are calendar bounds only.
    deliveryDays: null,
    calendarConfirmed: false,
    lastVerifiedAt: '2026-10-13',
    version: 1,
  },
];

// ---- Risk views (InventoryRiskView) ----

function sources(termsVersion: number | null) {
  return {
    stockSnapshotId: SNAPSHOT_ID,
    salesThrough: WINDOW.end,
    termsVersion,
    policyVersion: POLICY_VERSION,
  };
}

function delivery(days: number, reason: string): InventoryRiskView['deliveryEstimate'] {
  const date = new Date(Date.UTC(2026, 9, 13 + days)).toISOString().slice(0, 10);
  return { kind: 'known', date, confirmed: false, reason };
}

const UNCONFIRMED = (days: number, calendar: boolean): InventoryRiskView['deliveryEstimate'] =>
  delivery(
    days,
    calendar
      ? `calendar lower bound: ${days} days from ${STOCK_AS_OF}; falls on a delivery day — unconfirmed estimate, not a supplier slot.`
      : `calendar lower bound: ${days} days from ${STOCK_AS_OF}; supplier has no delivery calendar on record — unconfirmed estimate, not a supplier slot.`,
  );

const atUnconfirmedWarning = (sku: string, estimate: InventoryRiskView['deliveryEstimate']) => ({
  code: 'delivery_estimate_unconfirmed',
  message:
    estimate.kind === 'known'
      ? `${sku}: ${estimate.reason}`
      : `${sku}: no supplier terms on record`,
});

function measured(total: string): InventoryRiskView['sales'] {
  return {
    kind: 'measured',
    total,
    coveredDays: 13,
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
  };
}

/** 13 daily values, Sep 30 – Oct 12; total 52, average 4. */
export const OAT_MILK_SALES_13D = [3, 4, 2, 5, 4, 6, 4, 3, 5, 4, 3, 5, 4] as const;

function dailySeries(units: readonly number[]): SalesPoint[] {
  return units.map((quantity, index) => {
    const date = new Date(Date.UTC(2026, 8, 30));
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), quantity: String(quantity) };
  });
}

export const RISK_VIEWS: InventoryRiskView[] = [
  {
    productId: 'PROD-001',
    sku: 'SKU-001',
    name: 'Oat milk 1 L',
    category: 'Dairy',
    baseUnit: 'each',
    stock: { kind: 'known', value: '12', unit: 'each', asOf: STOCK_AS_OF },
    sales: measured('52'),
    averageDailyDemand: { kind: 'known', value: '4' },
    coverDays: { kind: 'finite', value: '3' },
    leadTime: {
      kind: 'known',
      value: 5,
      unit: 'calendarDays',
      termsVersion: 1,
      calendarConfirmed: true,
    },
    estimatedDepletion: { kind: 'known', date: '2026-10-16' },
    deliveryEstimate: UNCONFIRMED(5, true),
    deliveryGap: { kind: 'finite', value: '2', unit: 'days' },
    riskState: 'atRisk',
    blockers: [],
    warnings: [atUnconfirmedWarning('SKU-001', UNCONFIRMED(5, true))],
    sourceVersions: sources(1),
  },
  {
    productId: 'PROD-002',
    sku: 'SKU-002',
    name: 'Jasmine rice 1 kg',
    category: 'Pantry',
    baseUnit: 'each',
    stock: { kind: 'known', value: '18', unit: 'each', asOf: STOCK_AS_OF },
    sales: measured('39'),
    averageDailyDemand: { kind: 'known', value: '3' },
    coverDays: { kind: 'finite', value: '6' },
    leadTime: {
      kind: 'known',
      value: 3,
      unit: 'calendarDays',
      termsVersion: 1,
      calendarConfirmed: true,
    },
    estimatedDepletion: { kind: 'known', date: '2026-10-19' },
    deliveryEstimate: UNCONFIRMED(3, true),
    deliveryGap: { kind: 'finite', value: '0', unit: 'days' },
    riskState: 'runningLow',
    blockers: [],
    warnings: [atUnconfirmedWarning('SKU-002', UNCONFIRMED(3, true))],
    sourceVersions: sources(1),
  },
  {
    productId: 'PROD-003',
    sku: 'SKU-003',
    name: 'Instant noodles 85 g',
    category: 'Pantry',
    baseUnit: 'each',
    stock: { kind: 'known', value: '32', unit: 'each', asOf: STOCK_AS_OF },
    sales: measured('104'),
    averageDailyDemand: { kind: 'known', value: '8' },
    coverDays: { kind: 'finite', value: '4' },
    leadTime: {
      kind: 'known',
      value: 5,
      unit: 'calendarDays',
      termsVersion: 1,
      calendarConfirmed: false,
    },
    estimatedDepletion: { kind: 'known', date: '2026-10-17' },
    deliveryEstimate: UNCONFIRMED(5, false),
    deliveryGap: { kind: 'finite', value: '1', unit: 'days' },
    riskState: 'atRisk',
    blockers: [],
    warnings: [atUnconfirmedWarning('SKU-003', UNCONFIRMED(5, false))],
    sourceVersions: sources(1),
  },
  {
    productId: 'PROD-004',
    sku: 'SKU-004',
    name: 'Sparkling water 500 ml',
    category: 'Beverages',
    baseUnit: 'each',
    stock: { kind: 'known', value: '24', unit: 'each', asOf: STOCK_AS_OF },
    sales: measured('78'),
    averageDailyDemand: { kind: 'known', value: '6' },
    coverDays: { kind: 'finite', value: '4' },
    leadTime: {
      kind: 'known',
      value: 2,
      unit: 'calendarDays',
      termsVersion: 1,
      calendarConfirmed: false,
    },
    estimatedDepletion: { kind: 'known', date: '2026-10-17' },
    deliveryEstimate: UNCONFIRMED(2, false),
    deliveryGap: { kind: 'finite', value: '0', unit: 'days' },
    riskState: 'runningLow',
    blockers: [],
    warnings: [atUnconfirmedWarning('SKU-004', UNCONFIRMED(2, false))],
    sourceVersions: sources(1),
  },
  {
    productId: 'PROD-005',
    sku: 'SKU-005',
    name: 'Chamomile tea · 20 bags',
    category: 'Beverages',
    baseUnit: 'each',
    stock: { kind: 'known', value: '22', unit: 'each', asOf: STOCK_AS_OF },
    sales: {
      kind: 'zeroVerified',
      coveredDays: 13,
      windowStart: WINDOW.start,
      windowEnd: WINDOW.end,
    },
    averageDailyDemand: { kind: 'known', value: '0' },
    coverDays: {
      kind: 'noRecentSales',
      reason: 'verified zero sales in the demand window — cover is not a number',
    },
    leadTime: {
      kind: 'known',
      value: 3,
      unit: 'calendarDays',
      termsVersion: 1,
      calendarConfirmed: false,
    },
    estimatedDepletion: { kind: 'unavailable', reason: 'verified zero sales — no depletion date' },
    deliveryEstimate: UNCONFIRMED(3, false),
    deliveryGap: { kind: 'unavailable', reason: 'cover or lead time unavailable' },
    riskState: 'noRecentSales',
    blockers: [],
    warnings: [
      atUnconfirmedWarning('SKU-005', UNCONFIRMED(3, false)),
      { code: 'no_recent_sales', message: 'SKU-005: verified zero sales in window' },
    ],
    sourceVersions: sources(1),
  },
  {
    productId: 'PROD-006',
    sku: 'SKU-006',
    name: 'All-purpose flour 1 kg',
    category: 'Pantry',
    baseUnit: 'each',
    stock: { kind: 'unknown', reason: 'no stock snapshot on record' },
    sales: { kind: 'missing', reason: 'sales history unavailable' },
    averageDailyDemand: { kind: 'unavailable', reason: 'sales history unavailable' },
    coverDays: { kind: 'unavailable', reason: 'stock quantity unknown' },
    leadTime: { kind: 'unavailable', reason: 'no supplier terms on record' },
    estimatedDepletion: { kind: 'unavailable', reason: 'stock quantity unknown' },
    deliveryEstimate: {
      kind: 'unavailable',
      reason: 'no supplier terms on record',
      confirmed: false,
    },
    deliveryGap: { kind: 'unavailable', reason: 'cover or lead time unavailable' },
    riskState: 'dataNeeded',
    blockers: [
      { code: 'stock_unknown', message: 'SKU-006: no stock snapshot on record' },
      { code: 'sales_history_missing', message: 'SKU-006: sales history unavailable' },
      { code: 'supplier_terms_missing', message: 'SKU-006: no supplier terms' },
    ],
    warnings: [],
    sourceVersions: {
      stockSnapshotId: null,
      salesThrough: null,
      termsVersion: null,
      policyVersion: POLICY_VERSION,
    },
  },
];

// ---- Products (ProductOut with embedded risk) ----

function product(
  index: number,
  sku: string,
  name: string,
  category: string,
  supplierId: string | null,
  terms: Product['terms'],
): Product {
  const risk = RISK_VIEWS[index];
  const supplier = SUPPLIERS.find((candidate) => candidate.id === supplierId) ?? null;
  return {
    id: risk.productId,
    sku,
    name,
    category,
    baseUnit: 'each',
    quantityPrecision: 0,
    status: 'active',
    supplier: supplier ? { id: supplier.id, code: supplier.code, name: supplier.name } : null,
    terms,
    risk,
  };
}

export const PRODUCTS: Product[] = [
  product(0, 'SKU-001', 'Oat milk 1 L', 'Dairy', 'SUP-001', {
    id: 'TERMS-001',
    supplierId: 'SUP-001',
    unitCost: '2.50',
    currency: 'USD',
    purchasePackUnits: 12,
    minimumOrderUnits: '24',
    leadTimeValue: 5,
    leadTimeUnit: 'calendarDays',
    version: 1,
  }),
  product(1, 'SKU-002', 'Jasmine rice 1 kg', 'Pantry', 'SUP-001', {
    id: 'TERMS-002',
    supplierId: 'SUP-001',
    unitCost: '4.00',
    currency: 'USD',
    purchasePackUnits: 6,
    minimumOrderUnits: '30',
    leadTimeValue: 3,
    leadTimeUnit: 'calendarDays',
    version: 1,
  }),
  product(2, 'SKU-003', 'Instant noodles 85 g', 'Pantry', 'SUP-002', {
    id: 'TERMS-003',
    supplierId: 'SUP-002',
    unitCost: '0.75',
    currency: 'USD',
    purchasePackUnits: 24,
    minimumOrderUnits: '48',
    leadTimeValue: 5,
    leadTimeUnit: 'calendarDays',
    version: 1,
  }),
  product(3, 'SKU-004', 'Sparkling water 500 ml', 'Beverages', 'SUP-002', {
    id: 'TERMS-004',
    supplierId: 'SUP-002',
    unitCost: '1.50',
    currency: 'USD',
    purchasePackUnits: 12,
    minimumOrderUnits: '24',
    leadTimeValue: 2,
    leadTimeUnit: 'calendarDays',
    version: 1,
  }),
  product(4, 'SKU-005', 'Chamomile tea · 20 bags', 'Beverages', 'SUP-002', {
    id: 'TERMS-005',
    supplierId: 'SUP-002',
    unitCost: '3.50',
    currency: 'USD',
    purchasePackUnits: 20,
    minimumOrderUnits: '20',
    leadTimeValue: 3,
    leadTimeUnit: 'calendarDays',
    version: 1,
  }),
  // No supplier, no terms, no snapshot, no sales: every input unknown.
  product(5, 'SKU-006', 'All-purpose flour 1 kg', 'Pantry', null, null),
];

export const SALES_SERIES: Record<string, SalesPoint[]> = {
  'PROD-001': dailySeries(OAT_MILK_SALES_13D),
  'PROD-002': dailySeries([3, 3, 4, 2, 3, 3, 4, 3, 2, 3, 3, 3, 3]),
  'PROD-003': dailySeries([8, 9, 7, 8, 8, 10, 7, 8, 8, 7, 8, 8, 8]),
  'PROD-004': dailySeries([6, 7, 5, 6, 6, 7, 5, 6, 7, 5, 6, 6, 6]),
  'PROD-005': dailySeries([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  'PROD-006': [],
};

// ---- Purchase orders (OrderSummary / OrderDetailOut) ----

export const ORDERS: OrderSummary[] = [
  {
    id: 'PO-0143',
    displayNumber: 'PO-2026-0143',
    supplierId: 'SUP-002',
    supplierName: 'Daily Goods Co.',
    currency: 'USD',
    itemSubtotal: '144.00',
    taxTreatment: 'excluded',
    shippingTreatment: 'excluded',
    documentStatus: 'approved',
    approvalId: 'APPROVAL-001',
    approvalStatus: 'active',
    planId: 'PLAN-001',
    productCount: 2,
    totalUnits: '144',
    createdAt: '2026-10-13T09:05:00Z',
  },
  {
    id: 'PO-0142',
    displayNumber: 'PO-2026-0142',
    supplierId: 'SUP-001',
    supplierName: 'Freshfield Foods',
    currency: 'USD',
    itemSubtotal: '240.00',
    taxTreatment: 'excluded',
    shippingTreatment: 'excluded',
    documentStatus: 'approved',
    approvalId: 'APPROVAL-001',
    approvalStatus: 'active',
    planId: 'PLAN-001',
    productCount: 2,
    totalUnits: '78',
    createdAt: '2026-10-13T09:05:00Z',
  },
  {
    id: 'PO-0138',
    displayNumber: 'PO-2026-0138',
    supplierId: 'SUP-001',
    supplierName: 'Freshfield Foods',
    currency: 'USD',
    itemSubtotal: '312.00',
    taxTreatment: 'excluded',
    shippingTreatment: 'excluded',
    documentStatus: 'superseded',
    approvalId: 'APPROVAL-000',
    approvalStatus: 'stale',
    planId: 'PLAN-000',
    productCount: 3,
    totalUnits: '96',
    createdAt: '2026-10-06T11:20:00Z',
  },
];

const ORDER_LINES: Record<string, OrderDetail['lines']> = {
  'PO-0142': [
    {
      productId: 'PROD-001',
      sku: 'SKU-001',
      productName: 'Oat milk 1 L',
      supplierId: 'SUP-001',
      baseUnits: '48',
      purchasePackUnits: 12,
      purchasePackCount: 4,
      unitCost: '2.50',
      currency: 'USD',
      lineTotal: '120.00',
    },
    {
      productId: 'PROD-002',
      sku: 'SKU-002',
      productName: 'Jasmine rice 1 kg',
      supplierId: 'SUP-001',
      baseUnits: '30',
      purchasePackUnits: 6,
      purchasePackCount: 5,
      unitCost: '4.00',
      currency: 'USD',
      lineTotal: '120.00',
    },
  ],
  'PO-0143': [
    {
      productId: 'PROD-003',
      sku: 'SKU-003',
      productName: 'Instant noodles 85 g',
      supplierId: 'SUP-002',
      baseUnits: '96',
      purchasePackUnits: 24,
      purchasePackCount: 4,
      unitCost: '0.75',
      currency: 'USD',
      lineTotal: '72.00',
    },
    {
      productId: 'PROD-004',
      sku: 'SKU-004',
      productName: 'Sparkling water 500 ml',
      supplierId: 'SUP-002',
      baseUnits: '48',
      purchasePackUnits: 12,
      purchasePackCount: 4,
      unitCost: '1.50',
      currency: 'USD',
      lineTotal: '72.00',
    },
  ],
};

export const ORDER_DETAILS: OrderDetail[] = ORDERS.map((order) => ({
  ...order,
  planVersion: order.planId === 'PLAN-001' ? 1 : null,
  lines: ORDER_LINES[order.id] ?? [],
  supplierSnapshot: {
    code: order.supplierId,
    name: order.supplierName,
    documentCurrency: order.currency,
  },
  disclaimer:
    'Order document only — nothing has been sent to the supplier; no purchase has been placed or accepted.',
}));

// ---- Restock plans (PlanSummaryOut / PlanDetailOut) ----

const APPROVAL: Approval = {
  id: 'APPROVAL-001',
  planId: 'PLAN-001',
  planVersion: 1,
  contentDigest: 'b0079f955a9191e5eb949beb2bbca2b03089c14a4fb71ed66cf84eee38c010b9',
  actorId: 'owner',
  approvedAt: '2026-10-13T09:10:00Z',
  status: 'active',
  acknowledgedWarnings: [],
  orders: ORDERS.filter((order) => order.planId === 'PLAN-001'),
};

function line(
  index: string,
  supplierId: string,
  supplierName: string,
  ruleTrace: Record<string, unknown>,
  explanation: string,
): PlanDetail['lines'][number] {
  const costs: Record<string, { unit: string; pack: number; count: number; total: string }> = {
    'PROD-001': { unit: '2.50', pack: 12, count: 4, total: '120.00' },
    'PROD-002': { unit: '4.00', pack: 6, count: 5, total: '120.00' },
    'PROD-003': { unit: '0.75', pack: 24, count: 4, total: '72.00' },
    'PROD-004': { unit: '1.50', pack: 12, count: 4, total: '72.00' },
  };
  const product = PRODUCTS.find((candidate) => candidate.id === index);
  const cost = costs[index];
  if (!product || !cost) throw new Error(`fixture line: unknown product ${index}`);
  const suggested = String(cost.pack * cost.count);
  return {
    id: `LINE-${index.slice(-3)}`,
    productId: index,
    sku: product.sku,
    productName: product.name,
    supplierId,
    supplierName,
    selected: true,
    originalSuggestedBaseUnits: suggested,
    editedBaseUnits: null,
    effectiveBaseUnits: suggested,
    purchasePackUnits: cost.pack,
    purchasePackCount: cost.count,
    unitCost: cost.unit,
    currency: 'USD',
    lineTotal: cost.total,
    termsVersion: 1,
    ruleTrace,
    constraintResults: [
      { code: 'nonnegative_quantity', status: 'pass' },
      { code: 'pack_multiple', status: 'pass' },
      { code: 'minimum_order_units', status: 'pass' },
    ],
    explanation,
  };
}

const PLAN_LINES: PlanDetail['lines'] = [
  line(
    'PROD-001',
    'SUP-001',
    'Freshfield Foods',
    {
      demandPerDay: '4',
      coverDays: '3',
      targetDays: 7,
      leadTimeDays: 5,
      safetyDays: 2,
      horizonDays: 14,
      grossTargetUnits: '56',
      onHandUnits: '12',
      rawRequiredUnits: '44',
      minimumOrderUnits: '24',
      purchasePackUnits: 12,
      roundedUnits: '48',
      purchasePackCount: 4,
      excessUnits: '4',
      moqApplied: false,
      formula: 'raw = max(0, d*(T+L+B) - S); units = P * ceil(max(raw, MOQ) / P)',
    },
    '48 units (4 packs of 12): target 14 days x 4/day = 56 gross, less 12 on hand = 44 raw; rounded to 48 units for pack/MOQ rules; line total USD 120.00.',
  ),
  line(
    'PROD-002',
    'SUP-001',
    'Freshfield Foods',
    {
      demandPerDay: '3',
      coverDays: '6',
      targetDays: 7,
      leadTimeDays: 3,
      safetyDays: 2,
      horizonDays: 12,
      grossTargetUnits: '36',
      onHandUnits: '18',
      rawRequiredUnits: '18',
      minimumOrderUnits: '30',
      purchasePackUnits: 6,
      roundedUnits: '30',
      purchasePackCount: 5,
      excessUnits: '12',
      moqApplied: true,
      formula: 'raw = max(0, d*(T+L+B) - S); units = P * ceil(max(raw, MOQ) / P)',
    },
    '30 units (5 packs of 6): target 12 days x 3/day = 36 gross, less 18 on hand = 18 raw; rounded to 30 units for pack/MOQ rules; line total USD 120.00; MOQ 30 applied.',
  ),
  line(
    'PROD-003',
    'SUP-002',
    'Daily Goods Co.',
    {
      demandPerDay: '8',
      coverDays: '4',
      targetDays: 7,
      leadTimeDays: 5,
      safetyDays: 2,
      horizonDays: 14,
      grossTargetUnits: '112',
      onHandUnits: '32',
      rawRequiredUnits: '80',
      minimumOrderUnits: '48',
      purchasePackUnits: 24,
      roundedUnits: '96',
      purchasePackCount: 4,
      excessUnits: '16',
      moqApplied: false,
      formula: 'raw = max(0, d*(T+L+B) - S); units = P * ceil(max(raw, MOQ) / P)',
    },
    '96 units (4 packs of 24): target 14 days x 8/day = 112 gross, less 32 on hand = 80 raw; rounded to 96 units for pack/MOQ rules; line total USD 72.00.',
  ),
  line(
    'PROD-004',
    'SUP-002',
    'Daily Goods Co.',
    {
      demandPerDay: '6',
      coverDays: '4',
      targetDays: 7,
      leadTimeDays: 2,
      safetyDays: 2,
      horizonDays: 11,
      grossTargetUnits: '66',
      onHandUnits: '24',
      rawRequiredUnits: '42',
      minimumOrderUnits: '24',
      purchasePackUnits: 12,
      roundedUnits: '48',
      purchasePackCount: 4,
      excessUnits: '6',
      moqApplied: false,
      formula: 'raw = max(0, d*(T+L+B) - S); units = P * ceil(max(raw, MOQ) / P)',
    },
    '48 units (4 packs of 12): target 11 days x 6/day = 66 gross, less 24 on hand = 42 raw; rounded to 48 units for pack/MOQ rules; line total USD 72.00.',
  ),
];

const PLAN_WARNINGS: PlanDetail['warnings'] = [
  {
    code: 'tax_shipping_excluded',
    message: 'Tax and shipping are excluded from plan totals — excluded, not zero.',
  },
  {
    code: 'delivery_estimate_unconfirmed',
    message:
      'Freshfield Foods: calendar lower bound: 5 days from 2026-10-13 — unconfirmed estimate, not a supplier slot.',
  },
  {
    code: 'delivery_estimate_unconfirmed',
    message:
      'Daily Goods Co.: calendar lower bound: 3 days from 2026-10-13; supplier has no delivery calendar on record — unconfirmed estimate, not a supplier slot.',
  },
];

function planDetail(id: string, createdAt: string, approved: boolean): PlanDetail {
  return {
    id,
    activeApprovalId: approved ? APPROVAL.id : null,
    storeId: 'STORE-001',
    version: 1,
    calculationStatus: 'valid',
    reviewStatus: approved ? 'approved' : 'draft',
    policyVersion: POLICY_VERSION,
    explanationSource: 'rule-based',
    sourceVersions: {
      salesThrough: WINDOW.end,
      stockAsOf: STOCK_AS_OF,
      termsVersions: { 'PROD-001': 1, 'PROD-002': 1, 'PROD-003': 1, 'PROD-004': 1 },
    },
    totalsByCurrency: { USD: '384.00' },
    budgets: [
      {
        currency: 'USD',
        budgetAmount: '500.00',
        selectedTotal: '384.00',
        remaining: '116.00',
        utilizationPercent: '76.8',
        taxTreatment: 'excluded',
        shippingTreatment: 'excluded',
      },
    ],
    supplierGroups: [
      {
        supplierId: 'SUP-001',
        supplierCode: 'SUP-001',
        supplierName: 'Freshfield Foods',
        currency: 'USD',
        leadTimeDays: 5,
        lineCount: 2,
        subtotal: '240.00',
      },
      {
        supplierId: 'SUP-002',
        supplierCode: 'SUP-002',
        supplierName: 'Daily Goods Co.',
        currency: 'USD',
        leadTimeDays: 3,
        lineCount: 2,
        subtotal: '144.00',
      },
    ],
    lines: structuredClone(PLAN_LINES),
    blockers: [],
    warnings: structuredClone(PLAN_WARNINGS),
    activeApproval: approved ? structuredClone(APPROVAL) : null,
    createdAt,
    updatedAt: createdAt,
  };
}

export const APPROVED_PLAN = planDetail('PLAN-001', '2026-10-13T09:00:00Z', true);
export const DRAFT_PLAN = planDetail('PLAN-002', '2026-10-13T10:05:00Z', false);

/** Newest first, like the backend list. */
export const PLAN_SUMMARIES: PlanSummary[] = [DRAFT_PLAN, APPROVED_PLAN].map((plan) => ({
  id: plan.id,
  version: plan.version,
  calculationStatus: plan.calculationStatus,
  reviewStatus: plan.reviewStatus,
  totalsByCurrency: plan.totalsByCurrency,
  activeApprovalId: plan.activeApproval?.id ?? null,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
}));
