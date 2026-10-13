import type {
  Approval,
  DeliveryEstimate,
  ExportAttempt,
  ImportIssue,
  ImportPreview,
  InventoryRiskItem,
  Maybe,
  OrderLine,
  Plan,
  PlanBudget,
  PlanLine,
  Product,
  ProductDetail,
  PurchaseOrder,
  PurchaseOrderDetail,
  RiskState,
  SalesValue,
  StockValue,
  Supplier,
  SupplierDetail,
  SupplierGroup,
  SupplierTerms,
} from '@/lib/api';
import { usd } from '@/lib/money';

import {
  coverDays,
  lineTotalMinor,
  rawRequired,
  suggestUnits,
  utilizationPercent,
} from './calculations';

/**
 * Acceptance fixture — reproduces the verified arithmetic from
 * .docs/CALCULATION-RULES.md and T-11..T-14 exactly:
 *
 *   Oat milk      48 units (4 × 12) @ 2.50 = 120.00
 *   Jasmine rice  30 units (5 × 6)  @ 4.00 = 120.00
 *   Noodles       96 units (4 × 24) @ 0.75 =  72.00
 *   Sparkling H2O 48 units (4 × 12) @ 1.50 =  72.00
 *   Total        222 units                    384.00
 *   Freshfield 240.00 + Daily Goods 144.00; budget 500.00; remaining 116.00;
 *   utilization 76.8%; tax/shipping EXCLUDED (not zero).
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

// ---- Oat-milk fixture inputs (T-11: 12 stock, 4/day, 3 days cover, 5d lead) ----

export const OAT_MILK = {
  stock: 12,
  demandPerDay: 4,
  targetDays: 7,
  leadDays: 5,
  safetyDays: 2,
  packUnits: 12,
  minOrderUnits: 24,
  unitCostMinor: 250,
} as const;

export const OAT_MILK_RAW_REQUIRED = rawRequired(
  OAT_MILK.demandPerDay,
  OAT_MILK.stock,
  OAT_MILK.targetDays,
  OAT_MILK.leadDays,
  OAT_MILK.safetyDays,
); // 4 × (7 + 5 + 2) − 12 = 44

export const OAT_MILK_SUGGESTED_UNITS = suggestUnits(
  OAT_MILK_RAW_REQUIRED,
  OAT_MILK.packUnits,
  OAT_MILK.minOrderUnits,
); // 12 × ceil(44 / 12) = 48

export const OAT_MILK_SALES_WINDOW = { start: '2026-09-30', end: '2026-10-12' } as const;

/** 13 daily values, Sep 30 – Oct 12; total 52, average 4. */
export const OAT_MILK_SALES_13D = [3, 4, 2, 5, 4, 6, 4, 3, 5, 4, 3, 5, 4] as const;

export const OAT_MILK_DAILY_SALES = OAT_MILK_SALES_13D.map((units, index) => {
  const date = new Date(Date.UTC(2026, 8, 30)); // window start: Sep 30, 2026
  date.setUTCDate(date.getUTCDate() + index);
  return { date: date.toISOString().slice(0, 10), units };
});
export const PACK_MOQ_CASE = { rawDemand: 17, packUnits: 12, minOrderUnits: 24 } as const;

export const FIXTURE_BUDGET_MINOR = 50_000; // USD 500.00

// ---- Catalog ----

export const PRODUCTS: Product[] = [
  {
    id: 'PROD-OAT',
    sku: 'SKU-001',
    name: 'Oat milk',
    category: 'Dairy alternatives',
    baseUnit: 'each',
  },
  { id: 'PROD-RICE', sku: 'SKU-002', name: 'Jasmine rice', category: 'Grains', baseUnit: 'each' },
  {
    id: 'PROD-NOODLE',
    sku: 'SKU-003',
    name: 'Instant noodles',
    category: 'Snacks',
    baseUnit: 'each',
  },
  {
    id: 'PROD-WATER',
    sku: 'SKU-004',
    name: 'Sparkling water',
    category: 'Beverages',
    baseUnit: 'each',
  },
  { id: 'PROD-TEA', sku: 'SKU-005', name: 'Decaf tea', category: 'Beverages', baseUnit: 'each' },
  { id: 'PROD-SOAP', sku: 'SKU-006', name: 'Dish soap', category: 'Household', baseUnit: 'each' },
  {
    id: 'PROD-COFFEE',
    sku: 'SKU-007',
    name: 'Ground coffee',
    category: 'Beverages',
    baseUnit: 'each',
  },
];

export const SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    code: 'SUP-001',
    name: 'Freshfield Foods',
    contactName: 'Dana Okafor',
    email: 'orders@freshfield.example',
    documentCurrency: 'USD',
    leadTimeDays: 5,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    cutoffTime: '15:00',
    lastVerifiedAt: '2026-09-28T14:00:00Z',
  },
  {
    id: 'SUP-002',
    code: 'SUP-002',
    name: 'Daily Goods Co.',
    contactName: 'Sam Rivera',
    email: 'sales@dailygoods.example',
    documentCurrency: 'USD',
    leadTimeDays: 3,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    cutoffTime: '17:00',
    lastVerifiedAt: '2026-10-05T10:30:00Z',
  },
];

export const SUPPLIER_TERMS: SupplierTerms[] = [
  {
    productId: 'PROD-OAT',
    supplierId: 'SUP-001',
    unitCost: usd(250),
    purchasePackUnits: 12,
    minimumOrderUnits: 24,
    leadTimeDays: 5,
  },
  {
    productId: 'PROD-RICE',
    supplierId: 'SUP-001',
    unitCost: usd(400),
    purchasePackUnits: 6,
    minimumOrderUnits: 6,
    leadTimeDays: 5,
  },
  {
    productId: 'PROD-NOODLE',
    supplierId: 'SUP-002',
    unitCost: usd(75),
    purchasePackUnits: 24,
    minimumOrderUnits: 24,
    leadTimeDays: 3,
  },
  {
    productId: 'PROD-WATER',
    supplierId: 'SUP-002',
    unitCost: usd(150),
    purchasePackUnits: 12,
    minimumOrderUnits: 12,
    leadTimeDays: 3,
  },
  {
    productId: 'PROD-TEA',
    supplierId: 'SUP-002',
    unitCost: usd(350),
    purchasePackUnits: 20,
    minimumOrderUnits: 20,
    leadTimeDays: 3,
  },
  {
    productId: 'PROD-COFFEE',
    supplierId: 'SUP-002',
    unitCost: usd(525),
    purchasePackUnits: 12,
    minimumOrderUnits: 12,
    leadTimeDays: 3,
  },
];

export const SUPPLIER_DETAILS: SupplierDetail[] = SUPPLIERS.map((supplier) => {
  const terms = SUPPLIER_TERMS.filter((term) => term.supplierId === supplier.id);
  return {
    ...supplier,
    terms,
    products: terms.flatMap((term) => {
      const product = PRODUCTS.find((candidate) => candidate.id === term.productId);
      return product ? [{ productId: product.id, sku: product.sku, name: product.name }] : [];
    }),
  };
});

/**
 * Delivery estimates are calendar lower bounds, never confirmed slots.
 * Oct 13 + 5 days = Sunday Oct 18; Freshfield delivers Mon–Fri → unconfirmed.
 */
export const DELIVERY_ESTIMATES: Record<string, DeliveryEstimate> = {
  'SUP-001': {
    kind: 'estimated',
    date: '2026-10-18',
    confirmed: false,
    note: 'Sunday — outside Freshfield Foods’ Monday–Friday window. Calendar estimate only, not a confirmed delivery slot.',
  },
  'SUP-002': {
    kind: 'estimated',
    date: '2026-10-16',
    confirmed: false,
    note: 'Calendar estimate only, not a confirmed delivery slot.',
  },
};

// ---- Derived risk view (read-only; the API owns these numbers) ----

const FOURTEEN_DAY_WINDOW = { start: '2026-09-29', end: '2026-10-12' } as const;
const SNAPSHOT_AS_OF = '2026-10-13T09:00:00Z';

function measured(
  total: number,
  coveredDays: number,
  window: { start: string; end: string },
): SalesValue {
  return {
    kind: 'measured',
    totalUnits: total,
    coveredDays,
    windowStart: window.start,
    windowEnd: window.end,
  };
}

function knownStock(quantity: number, asOf: string = SNAPSHOT_AS_OF): StockValue {
  return { kind: 'known', value: quantity, asOf };
}

export const INVENTORY_RISK: InventoryRiskItem[] = [
  {
    productId: 'PROD-OAT',
    sku: 'SKU-001',
    name: 'Oat milk',
    stock: knownStock(12),
    sales: measured(52, 13, OAT_MILK_SALES_WINDOW),
    coverDays: coverDays(12, 4),
    averageDailyDemand: { kind: 'known', value: 4 },
    leadTimeDays: { kind: 'known', value: 5 },
    riskState: 'atRisk',
    blockers: [],
    warnings: [
      'Delivery timing unconfirmed: Oct 18, 2026 is a Sunday; Freshfield Foods delivers Monday–Friday.',
      'Delivery gap: 3 days of cover against a 5-day lead time leaves at least 2 days uncovered after ordering.',
    ],
  },
  {
    productId: 'PROD-RICE',
    sku: 'SKU-002',
    name: 'Jasmine rice',
    stock: knownStock(24),
    sales: measured(28, 14, FOURTEEN_DAY_WINDOW),
    coverDays: coverDays(24, 2),
    averageDailyDemand: { kind: 'known', value: 2 },
    leadTimeDays: { kind: 'known', value: 5 },
    riskState: 'healthy',
    blockers: [],
    warnings: [],
  },
  {
    productId: 'PROD-NOODLE',
    sku: 'SKU-003',
    name: 'Instant noodles',
    stock: knownStock(36),
    sales: measured(72, 12, FOURTEEN_DAY_WINDOW),
    coverDays: coverDays(36, 6),
    averageDailyDemand: { kind: 'known', value: 6 },
    leadTimeDays: { kind: 'known', value: 3 },
    riskState: 'runningLow',
    blockers: [],
    warnings: [],
  },
  {
    productId: 'PROD-WATER',
    sku: 'SKU-004',
    name: 'Sparkling water',
    stock: knownStock(96),
    sales: measured(48, 12, FOURTEEN_DAY_WINDOW),
    coverDays: coverDays(96, 4),
    averageDailyDemand: { kind: 'known', value: 4 },
    leadTimeDays: { kind: 'known', value: 3 },
    riskState: 'healthy',
    blockers: [],
    warnings: [],
  },
  {
    // Verified zero sales is its own state — not missing data, not healthy.
    productId: 'PROD-TEA',
    sku: 'SKU-005',
    name: 'Decaf tea',
    stock: knownStock(40),
    sales: {
      kind: 'zeroVerified',
      windowStart: FOURTEEN_DAY_WINDOW.start,
      windowEnd: FOURTEEN_DAY_WINDOW.end,
    },
    coverDays: coverDays(40, 0),
    averageDailyDemand: { kind: 'known', value: 0 },
    leadTimeDays: { kind: 'known', value: 3 },
    riskState: 'noRecentSales',
    blockers: [],
    warnings: [],
  },
  {
    // Missing inputs are unknown, never zero.
    productId: 'PROD-SOAP',
    sku: 'SKU-006',
    name: 'Dish soap',
    stock: { kind: 'unknown', reason: 'No stock count has been imported for this product.' },
    sales: { kind: 'missing', reason: 'No sales history — import sales data to estimate demand.' },
    coverDays: { kind: 'unavailable', reason: 'Demand is unknown.' },
    averageDailyDemand: { kind: 'unknown', reason: 'No sales history on file.' },
    leadTimeDays: { kind: 'unknown', reason: 'No supplier terms on file.' },
    riskState: 'dataNeeded',
    blockers: [
      'Missing stock count and sales history — import data or count stock to assess this product.',
    ],
    warnings: [],
  },
  {
    productId: 'PROD-COFFEE',
    sku: 'SKU-007',
    name: 'Ground coffee',
    stock: knownStock(20, '2026-09-22T09:00:00Z'),
    sales: measured(60, 12, FOURTEEN_DAY_WINDOW),
    coverDays: coverDays(20, 5),
    averageDailyDemand: { kind: 'known', value: 5 },
    leadTimeDays: { kind: 'known', value: 3 },
    riskState: 'stale',
    blockers: [],
    warnings: ['Stock snapshot is 21 days old (Sep 22, 2026) — counts may be out of date.'],
  },
];

const DEPLETION_DAYS: Record<string, Maybe<number>> = {
  'PROD-OAT': { kind: 'known', value: 3, asOf: SNAPSHOT_AS_OF },
  'PROD-RICE': { kind: 'known', value: 12, asOf: SNAPSHOT_AS_OF },
  'PROD-NOODLE': { kind: 'known', value: 6, asOf: SNAPSHOT_AS_OF },
  'PROD-WATER': { kind: 'known', value: 24, asOf: SNAPSHOT_AS_OF },
  'PROD-TEA': { kind: 'unknown', reason: 'No recent sales — depletion not estimated.' },
  'PROD-SOAP': { kind: 'unknown', reason: 'Stock is unknown — import a stock count first.' },
  'PROD-COFFEE': { kind: 'known', value: 4, asOf: '2026-09-22T09:00:00Z' },
};

export const PRODUCT_DETAILS: ProductDetail[] = PRODUCTS.map((product) => {
  const risk = INVENTORY_RISK.find((candidate) => candidate.productId === product.id);
  if (!risk) throw new Error(`Fixture product without risk view: ${product.id}`);
  const terms = SUPPLIER_TERMS.filter((term) => term.productId === product.id);
  const supplierId = terms[0]?.supplierId;
  return {
    ...product,
    stock: risk.stock,
    sales: risk.sales,
    coverDays: risk.coverDays,
    riskState: risk.riskState as RiskState,
    supplierTerms: terms,
    dailySales: product.id === 'PROD-OAT' ? OAT_MILK_DAILY_SALES : [],
    estimatedDepletionDays: DEPLETION_DAYS[product.id] ?? {
      kind: 'unknown',
      reason: 'Not estimated.',
    },
    deliveryEstimate: supplierId
      ? (DELIVERY_ESTIMATES[supplierId] ?? {
          kind: 'unavailable',
          confirmed: false,
          reason: 'No delivery calendar on file.',
        })
      : { kind: 'unavailable', confirmed: false, reason: 'No supplier terms on file.' },
  };
});

// ---- Restock plan (acceptance fixture) ----

export const PLAN_ID = 'PLAN-001';

export interface FixtureLineInput {
  lineId: string;
  productId: string;
  supplierId: string;
  suggestedBaseUnits: number;
  packUnits: number;
  unitCostMinor: number;
  rawRequiredUnits: number | null;
}

/**
 * Oat milk derives from the approved formula above. Rice/noodles/water are
 * author-written fixture values, not claimed outputs of one global formula
 * (CALCULATION-RULES.md forbids inventing derivations for those rows).
 */
export const PLAN_LINE_INPUTS: readonly FixtureLineInput[] = [
  {
    lineId: 'PL-001',
    productId: 'PROD-OAT',
    supplierId: 'SUP-001',
    suggestedBaseUnits: OAT_MILK_SUGGESTED_UNITS,
    packUnits: 12,
    unitCostMinor: 250,
    rawRequiredUnits: OAT_MILK_RAW_REQUIRED,
  },
  {
    lineId: 'PL-002',
    productId: 'PROD-RICE',
    supplierId: 'SUP-001',
    suggestedBaseUnits: 30,
    packUnits: 6,
    unitCostMinor: 400,
    rawRequiredUnits: null,
  },
  {
    lineId: 'PL-003',
    productId: 'PROD-NOODLE',
    supplierId: 'SUP-002',
    suggestedBaseUnits: 96,
    packUnits: 24,
    unitCostMinor: 75,
    rawRequiredUnits: null,
  },
  {
    lineId: 'PL-004',
    productId: 'PROD-WATER',
    supplierId: 'SUP-002',
    suggestedBaseUnits: 48,
    packUnits: 12,
    unitCostMinor: 150,
    rawRequiredUnits: null,
  },
];

export const PLAN_WARNINGS = [
  'Tax and shipping are excluded from these totals — they are not zero-cost items.',
  'Delivery estimates are calendar lower bounds, not confirmed supplier slots.',
] as const;

export function buildMockPlan(): Plan {
  const lines: PlanLine[] = PLAN_LINE_INPUTS.map((input) => {
    const product = PRODUCTS.find((candidate) => candidate.id === input.productId);
    const supplier = SUPPLIERS.find((candidate) => candidate.id === input.supplierId);
    if (!product || !supplier) {
      throw new Error(`Fixture line references an unknown product or supplier: ${input.lineId}`);
    }
    const units = input.suggestedBaseUnits;
    return {
      id: input.lineId,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      selected: true,
      suggestedBaseUnits: units,
      editedBaseUnits: null,
      purchasePackUnits: input.packUnits,
      purchasePackCount: units / input.packUnits,
      rawRequiredUnits: input.rawRequiredUnits,
      excessUnits:
        input.rawRequiredUnits === null ? null : Math.max(0, units - input.rawRequiredUnits),
      unitCost: usd(input.unitCostMinor),
      lineTotal: usd(lineTotalMinor(units, input.unitCostMinor)),
      deliveryEstimate: DELIVERY_ESTIMATES[supplier.id] ?? {
        kind: 'unavailable',
        confirmed: false,
        reason: 'No delivery calendar on file.',
      },
      explanation:
        product.id === 'PROD-OAT'
          ? 'Rule-based: 4 units/day × (7 target + 5 lead + 2 safety) = 56 gross; minus 12 on hand = 44 needed; four packs of 12 = 48 units at USD 2.50 each.'
          : null,
    };
  });

  const supplierGroups: SupplierGroup[] = SUPPLIERS.map((supplier) => {
    const groupLines = lines.filter((line) => line.supplierId === supplier.id);
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      currency: 'USD',
      subtotal: usd(groupLines.reduce((total, line) => total + line.lineTotal.amountMinor, 0)),
      lineIds: groupLines.map((line) => line.id),
    };
  });

  const totalMinor = lines.reduce((total, line) => total + line.lineTotal.amountMinor, 0);
  const budgets: PlanBudget[] = [
    {
      currency: 'USD',
      budgetMinor: FIXTURE_BUDGET_MINOR,
      totalMinor,
      remainingMinor: FIXTURE_BUDGET_MINOR - totalMinor,
      utilizationPercent: utilizationPercent(totalMinor, FIXTURE_BUDGET_MINOR),
      taxIncluded: false,
      shippingIncluded: false,
    },
  ];

  return {
    id: PLAN_ID,
    status: 'draft',
    version: 1,
    explanationSource: 'rule-based',
    calculationStatus: 'valid',
    lines,
    supplierGroups,
    budgets,
    blockers: [],
    warnings: [...PLAN_WARNINGS],
    createdAt: '2026-10-13T08:15:00Z',
  };
}

// ---- Purchase orders ----

function fixtureOrderLines(supplierId: string): OrderLine[] {
  return PLAN_LINE_INPUTS.filter((input) => input.supplierId === supplierId).map((input) => {
    const product = PRODUCTS.find((candidate) => candidate.id === input.productId);
    if (!product)
      throw new Error(`Fixture order line references an unknown product: ${input.lineId}`);
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      baseUnits: input.suggestedBaseUnits,
      purchasePackUnits: input.packUnits,
      purchasePackCount: input.suggestedBaseUnits / input.packUnits,
      unitCost: usd(input.unitCostMinor),
      lineTotal: usd(lineTotalMinor(input.suggestedBaseUnits, input.unitCostMinor)),
    };
  });
}

export const ORDERS: PurchaseOrder[] = [
  {
    id: 'PO-2026-0041',
    displayNumber: 'PO-2026-0041',
    supplierId: 'SUP-001',
    supplierName: 'Freshfield Foods',
    currency: 'USD',
    documentStatus: 'ready',
    itemSubtotal: usd(24_000),
    taxTreatment: 'Excluded',
    shippingTreatment: 'Excluded',
    createdAt: '2026-10-13T09:05:00Z',
    approvalId: 'APR-0001',
    sourcePlanVersion: 1,
  },
  {
    id: 'PO-2026-0042',
    displayNumber: 'PO-2026-0042',
    supplierId: 'SUP-002',
    supplierName: 'Daily Goods Co.',
    currency: 'USD',
    documentStatus: 'exported',
    itemSubtotal: usd(14_400),
    taxTreatment: 'Excluded',
    shippingTreatment: 'Excluded',
    createdAt: '2026-10-12T16:40:00Z',
    approvalId: 'APR-0000',
    sourcePlanVersion: 1,
  },
];

const EXPORTS_BY_ORDER: Record<string, ExportAttempt[]> = {
  'PO-2026-0041': [
    {
      id: 'EXP-0001',
      status: 'succeeded',
      startedAt: '2026-10-13T09:07:00Z',
      completedAt: '2026-10-13T09:07:03Z',
      artifactName: 'PO-2026-0041-freshfield-foods.pdf',
      failureCode: null,
    },
  ],
  'PO-2026-0042': [
    {
      id: 'EXP-0002',
      status: 'succeeded',
      startedAt: '2026-10-12T16:45:00Z',
      completedAt: '2026-10-12T16:45:02Z',
      artifactName: 'PO-2026-0042-daily-goods-co.pdf',
      failureCode: null,
    },
  ],
};

export const ORDER_DETAILS: PurchaseOrderDetail[] = ORDERS.map((order) => ({
  ...order,
  lines: fixtureOrderLines(order.supplierId),
  exports: EXPORTS_BY_ORDER[order.id] ?? [],
}));

export const APPROVAL_FIXTURE: Approval = {
  id: 'APR-0001',
  planId: PLAN_ID,
  planVersion: 1,
  lineIds: PLAN_LINE_INPUTS.map((input) => input.lineId),
  contentDigest: 'fixture-demo-digest',
  approvedAt: '2026-10-13T09:00:00Z',
  actorId: 'USER-001',
};

// ---- Imports ----

export const REQUIRED_IMPORT_COLUMNS = [
  'sku',
  'product_name',
  'stock_quantity',
  'unit_cost',
  'supplier_code',
] as const;

export function fixtureImportIssues(severity: 'all' | 'warning'): ImportIssue[] {
  const blocking: ImportIssue[] = [
    {
      rowNumber: 12,
      field: 'unit_cost',
      issueCode: 'invalid_decimal',
      severity: 'blocking',
      valuePreview: '2,50',
      expectedFormat: 'Decimal number with a dot, e.g. 2.50',
      correctionHint: 'Replace the comma with a dot.',
    },
    {
      rowNumber: 47,
      field: 'supplier_code',
      issueCode: 'missing_required',
      severity: 'blocking',
      valuePreview: '',
      expectedFormat: 'A known supplier code, e.g. SUP-001',
      correctionHint: 'Add the supplier code or remove the row.',
    },
  ];
  const warnings: ImportIssue[] = [
    {
      rowNumber: 88,
      field: 'stock_quantity',
      issueCode: 'empty_value',
      severity: 'warning',
      valuePreview: '',
      expectedFormat: 'Whole number of base units',
      correctionHint: 'Blank is treated as missing, not zero. Enter a count or drop the row.',
    },
  ];
  return severity === 'warning' ? warnings : [...blocking, ...warnings];
}

export function fixtureImportPreview(): ImportPreview {
  return {
    id: 'IMP-0001',
    dataset: 'stock',
    filename: 'stock-count-oct.csv',
    status: 'invalid',
    availableColumns: [...REQUIRED_IMPORT_COLUMNS, 'notes'],
    requiredColumns: [...REQUIRED_IMPORT_COLUMNS],
    mapping: {},
    totalRows: 120,
    validRows: 118,
    warningRows: 1,
    rejectedRows: 2,
    issues: fixtureImportIssues('all'),
  };
}
