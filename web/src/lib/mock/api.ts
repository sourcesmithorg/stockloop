import type {
  ApiClient,
  ImportPreview,
  PlanDetail,
  PreviewImportInput,
  ProductDetail,
  UpdatePlanLineInput,
} from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  APPROVED_PLAN,
  DRAFT_PLAN,
  ORDER_DETAILS,
  ORDERS,
  PRODUCTS,
  SALES_SERIES,
  SUPPLIERS,
} from './fixtures';

import {
  mockGetStore,
  mockLogin,
  mockLogout,
  mockMe,
  mockRegister,
  mockUpdatePreferences,
  mockUpdateStore,
} from './auth';

/**
 * Fixture API — implements the same ApiClient contract as the real /api
 * backend (api/app/schemas.py shapes) so screens developed against `api` from
 * '@/lib/api' switch with one env flag. Unknown ids throw ApiError(404), which
 * the not-found route consumes.
 *
 * ponytail: one global demo dataset (not per-store) — demo mode is isolated by
 * the VITE_USE_MOCK flag, and the real backend owns scoping and durability.
 */

// In-memory plan state; every read deep-clones so callers cannot mutate it.
const plans = new Map<string, PlanDetail>([
  [APPROVED_PLAN.id, structuredClone(APPROVED_PLAN)],
  [DRAFT_PLAN.id, structuredClone(DRAFT_PLAN)],
]);
const planOrder = [DRAFT_PLAN.id, APPROVED_PLAN.id]; // newest first

const importPreviews = new Map<string, ImportPreview>();
let importCounter = 0;
let storeVersionCounter = 6;
let documentCounter = 143;

function notFound(kind: string, id: string): never {
  throw new ApiError(404, `${kind} ${id} not found`);
}

// ---- decimal helpers (demo math only; the backend is authoritative) ----

function cents(value: string): number {
  return Math.round(Number(value) * 100);
}

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

function quantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Recompute server-side-derived plan numbers after a demo edit. */
function recomputeDerived(plan: PlanDetail): void {
  const totals = new Map<string, number>();
  const perSupplier = new Map<string, number>();
  for (const line of plan.lines) {
    if (!line.selected) continue;
    const totalMinor = Math.round(Number(line.effectiveBaseUnits) * cents(line.unitCost));
    line.lineTotal = money(totalMinor);
    totals.set(line.currency, (totals.get(line.currency) ?? 0) + totalMinor);
    const key = `${line.supplierId}:${line.currency}`;
    perSupplier.set(key, (perSupplier.get(key) ?? 0) + totalMinor);
  }
  plan.totalsByCurrency = Object.fromEntries(
    [...totals].map(([currency, value]) => [currency, money(value)]),
  );
  for (const group of plan.supplierGroups) {
    group.subtotal = money(perSupplier.get(`${group.supplierId}:${group.currency}`) ?? 0);
  }
  for (const budget of plan.budgets) {
    const total = totals.get(budget.currency) ?? 0;
    budget.selectedTotal = money(total);
    if (budget.budgetAmount === null) {
      budget.remaining = null;
      budget.utilizationPercent = null;
    } else {
      const budgetMinor = cents(budget.budgetAmount);
      budget.remaining = money(budgetMinor - total);
      budget.utilizationPercent = String(
        budgetMinor === 0 ? 0 : Math.round((total / budgetMinor) * 1000) / 10,
      );
    }
  }
}

// ---- tiny CSV reader (demo only; the backend validates for real) ----

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const headers = (lines.shift() ?? '').split(',').map((header) => header.trim());
  return { headers, rows: lines.map((line) => line.split(',').map((cell) => cell.trim())) };
}

const REQUIRED_COLUMNS: Record<PreviewImportInput['dataset'], string[]> = {
  inventory: ['sku', 'stock_on_hand', 'snapshot_date'],
  sales: ['sku', 'sale_date', 'quantity_sold'],
};

export const mockApi: ApiClient = {
  async getHealth() {
    return {
      status: 'ok',
      db: { reachable: true, latencyMs: 2, error: null },
      version: '0.1.0-mock',
    };
  },

  async getSuppliers() {
    return structuredClone(SUPPLIERS);
  },

  async getSupplier(id) {
    const supplier = SUPPLIERS.find((candidate) => candidate.id === id);
    if (!supplier) notFound('Supplier', id);
    return structuredClone(supplier);
  },

  async getProducts() {
    return structuredClone(PRODUCTS);
  },

  async getProduct(id) {
    const product = PRODUCTS.find((candidate) => candidate.id === id);
    if (!product) notFound('Product', id);
    const detail: ProductDetail = {
      ...structuredClone(product),
      salesSeries: structuredClone(SALES_SERIES[id] ?? []),
    };
    return detail;
  },

  async getInventoryRisk() {
    return structuredClone(PRODUCTS.map((product) => product.risk));
  },

  async getPlans() {
    return planOrder.map((id) => {
      const plan = plans.get(id);
      if (!plan) notFound('Plan', id);
      return {
        id: plan.id,
        version: plan.version,
        calculationStatus: plan.calculationStatus,
        reviewStatus: plan.reviewStatus,
        totalsByCurrency: plan.totalsByCurrency,
        activeApprovalId: plan.activeApproval?.id ?? null,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      };
    });
  },

  async getPlan(id) {
    const plan = plans.get(id);
    if (!plan) notFound('Plan', id);
    return structuredClone(plan);
  },

  async updatePlanLine(planId, lineId, input: UpdatePlanLineInput) {
    const plan = plans.get(planId);
    if (!plan) notFound('Plan', planId);
    const line = plan.lines.find((candidate) => candidate.id === lineId);
    if (!line) notFound('Plan line', lineId);
    if (input.expectedPlanVersion !== plan.version) {
      throw new ApiError(
        409,
        `Plan version conflict: expected ${input.expectedPlanVersion}, current version is ${plan.version}. Reload before editing.`,
      );
    }

    const units = Number(input.editedBaseUnits);
    if (!Number.isInteger(units) || units < 0) {
      throw new ApiError(422, 'Quantity must be a non-negative whole number of base units.');
    }
    if (units % line.purchasePackUnits !== 0) {
      throw new ApiError(
        422,
        `Quantity must be a multiple of the purchase pack (${line.purchasePackUnits} units). Off-pack edits need an approved rounding policy first.`,
      );
    }
    const moq = Number(
      PRODUCTS.find((product) => product.id === line.productId)?.terms?.minimumOrderUnits ?? 0,
    );
    if (units > 0 && units < moq) {
      throw new ApiError(
        422,
        `Quantity must be at least the ${moq}-unit minimum order, or zero to skip this line.`,
      );
    }

    line.editedBaseUnits = quantity(units);
    line.effectiveBaseUnits = quantity(units);
    line.purchasePackCount = units / line.purchasePackUnits;
    plan.version += 1;
    plan.reviewStatus = 'draft';
    recomputeDerived(plan);
    return structuredClone(plan);
  },

  async approvePlan(planId, input) {
    const plan = plans.get(planId);
    if (!plan) notFound('Plan', planId);
    if (input.expectedPlanVersion !== plan.version) {
      throw new ApiError(
        409,
        `Plan version conflict: expected ${input.expectedPlanVersion}, current version is ${plan.version}. Review the latest version before approving.`,
      );
    }
    if (plan.calculationStatus !== 'valid' || plan.blockers.length > 0) {
      throw new ApiError(422, 'This plan cannot be approved until its blockers are resolved.');
    }
    if (plan.activeApproval) {
      throw new ApiError(409, 'This plan version is already approved.');
    }

    const orders = plan.supplierGroups.map((group) => {
      documentCounter += 1;
      return {
        id: `PO-0${documentCounter}`,
        displayNumber: `PO-2026-0${documentCounter}`,
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        currency: group.currency,
        itemSubtotal: group.subtotal,
        taxTreatment: 'excluded',
        shippingTreatment: 'excluded',
        documentStatus: 'approved',
        approvalId: `APPROVAL-${plan.id}-v${plan.version}`,
        approvalStatus: 'active',
        planId: plan.id,
        productCount: group.lineCount,
        totalUnits: quantity(
          plan.lines
            .filter((line) => line.supplierId === group.supplierId && line.selected)
            .reduce((total, line) => total + Number(line.effectiveBaseUnits), 0),
        ),
        createdAt: new Date().toISOString(),
      };
    });
    const approval = {
      id: `APPROVAL-${plan.id}-v${plan.version}`,
      planId: plan.id,
      planVersion: plan.version,
      contentDigest: `digest-${plan.id}-v${plan.version}`,
      actorId: input.actorId ?? 'owner',
      approvedAt: new Date().toISOString(),
      status: 'active',
      acknowledgedWarnings: input.acknowledgedWarnings ?? [],
      orders,
    };
    plan.reviewStatus = 'approved';
    plan.activeApproval = approval;
    return structuredClone(approval);
  },

  async getOrders() {
    return structuredClone(ORDERS);
  },

  async getOrder(id) {
    const order = ORDER_DETAILS.find((candidate) => candidate.id === id);
    if (!order) notFound('Purchase order', id);
    return structuredClone(order);
  },

  async previewImport({ file, dataset }) {
    importCounter += 1;
    const importId = `IMP-${String(importCounter).padStart(4, '0')}`;
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const issues: ImportPreview['issues'] = [];
    const required = REQUIRED_COLUMNS[dataset];

    for (const column of required) {
      if (!headers.includes(column)) {
        issues.push({
          rowNumber: null,
          field: column,
          issueCode: 'missing_column',
          severity: 'blocking',
          valuePreview: null,
          expectedFormat: `a required ${dataset} column`,
          correctionHint: `Add a "${column}" column to the file, or fix the column mapping.`,
        });
      }
    }

    let validRows = 0;
    if (issues.length === 0) {
      const index = Object.fromEntries(headers.map((header, position) => [header, position]));
      for (const [offset, row] of rows.entries()) {
        const rowNumber = offset + 2; // 1-based, header is row 1
        let rowValid = true;
        const sku = row[index.sku] ?? '';
        if (!PRODUCTS.some((product) => product.sku === sku)) {
          issues.push({
            rowNumber,
            field: 'sku',
            issueCode: 'unknown_sku',
            severity: 'blocking',
            valuePreview: sku,
            expectedFormat: 'a SKU that exists in this store',
            correctionHint: 'Create the product or correct the SKU',
          });
          rowValid = false;
        }
        const quantityColumn = dataset === 'inventory' ? 'stock_on_hand' : 'quantity_sold';
        const raw = row[index[quantityColumn]] ?? '';
        const parsed = Number(raw);
        if (raw === '' || !Number.isFinite(parsed) || parsed < 0) {
          issues.push({
            rowNumber,
            field: quantityColumn,
            issueCode: 'invalid_quantity',
            severity: 'blocking',
            valuePreview: raw,
            expectedFormat: 'a finite, non-negative number',
            correctionHint: `${quantityColumn} must be non-negative, got "${raw}"`,
          });
          rowValid = false;
        }
        const dateColumn = dataset === 'inventory' ? 'snapshot_date' : 'sale_date';
        const rawDate = row[index[dateColumn]] ?? '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          issues.push({
            rowNumber,
            field: dateColumn,
            issueCode: 'invalid_date',
            severity: 'blocking',
            valuePreview: rawDate,
            expectedFormat: 'YYYY-MM-DD',
            correctionHint: `${dateColumn} must match YYYY-MM-DD, got "${rawDate}"`,
          });
          rowValid = false;
        }
        if (rowValid) validRows += 1;
      }
    }

    const rejectedRows = new Set(
      issues.filter((issue) => issue.rowNumber !== null).map((issue) => issue.rowNumber),
    ).size;
    const preview: ImportPreview = {
      importId,
      dataset,
      filename: file.name,
      byteSize: file.size,
      sourceDigest: `demo-${importId}`,
      schemaVersion: 'v1',
      commitPolicy: 'atomic',
      status: issues.length === 0 ? 'validated' : 'blocked',
      mapping: Object.fromEntries(required.map((column) => [column, column])),
      counts: {
        totalRows: rows.length,
        validRows: issues.length === 0 ? validRows : Math.max(0, rows.length - rejectedRows),
        warningRows: 0,
        rejectedRows,
      },
      issues,
      createdAt: new Date().toISOString(),
    };
    importPreviews.set(importId, preview);
    return structuredClone(preview);
  },

  async commitImport(importId) {
    const preview = importPreviews.get(importId);
    if (!preview) notFound('Import', importId);
    if (preview.status !== 'validated') {
      throw new ApiError(
        422,
        `Import ${importId} has ${preview.counts.rejectedRows} blocking row issue(s) — resolve them before committing.`,
      );
    }
    preview.status = 'committed';
    storeVersionCounter += 1;
    return {
      importId,
      dataset: preview.dataset,
      status: 'committed',
      appliedRows: preview.counts.validRows,
      skippedRows: preview.counts.rejectedRows,
      resultingStoreVersion: storeVersionCounter,
      committedAt: new Date().toISOString(),
    };
  },

  async explain(input) {
    const product = input.productId
      ? PRODUCTS.find((candidate) => candidate.id === input.productId)
      : undefined;
    const plan = input.planId ? plans.get(input.planId) : undefined;
    const lines = plan?.lines ?? (product ? [] : []);
    const explanations = (
      product
        ? [{ productId: product.id, summary: product.risk.warnings[0]?.message ?? product.name }]
        : lines.map((line) => ({ productId: line.productId, summary: line.explanation }))
    ).map((entry) => ({
      productId: entry.productId,
      sku: PRODUCTS.find((candidate) => candidate.id === entry.productId)?.sku ?? null,
      summary: entry.summary,
      citedInputKeys: [],
      assumptions: [],
      riskCodes: [],
    }));
    return {
      source: 'rule-based' as const,
      reason: 'No AI provider is configured in demo mode — deterministic explanation shown.',
      requestId: `demo-${Math.random().toString(36).slice(2, 8)}`,
      planId: input.planId ?? null,
      planVersion: plan?.version ?? null,
      productId: input.productId ?? null,
      explanations,
    };
  },

  login: mockLogin,
  register: mockRegister,
  logout: mockLogout,
  me: mockMe,
  getStore: () => Promise.resolve(mockGetStore()),
  updateStore: mockUpdateStore,
  updatePreferences: mockUpdatePreferences,
};
