import type { ApiClient, ImportPreview } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  APPROVAL_FIXTURE,
  INVENTORY_RISK,
  ORDER_DETAILS,
  ORDERS,
  PRODUCT_DETAILS,
  PRODUCTS,
  REQUIRED_IMPORT_COLUMNS,
  SUPPLIER_DETAILS,
  SUPPLIERS,
  buildMockPlan,
  fixtureImportIssues,
  fixtureImportPreview,
} from './fixtures';

/**
 * Fixture API — implements the same ApiClient contract as the real /api backend
 * so screens developed against `api` from '@/lib/api' switch with one env flag.
 * Unknown ids throw ApiError(404), which the not-found route consumes.
 *
 * Mutations honor the documented contracts loosely: version conflicts 409,
 * off-pack edits 422, approval requires a valid plan. The real backend stays
 * authoritative for these rules.
 */

const plan = buildMockPlan();
let importCounter = 0;
const importPreviews = new Map<string, ImportPreview>();

function plan404(kind: string, id: string): never {
  throw new ApiError(404, `${kind} ${id} not found`);
}

function recomputeDerived(updated: typeof plan): void {
  let total = 0;
  const perSupplier = new Map<string, number>();
  for (const line of updated.lines) {
    if (!line.selected) continue;
    total += line.lineTotal.amountMinor;
    perSupplier.set(
      line.supplierId,
      (perSupplier.get(line.supplierId) ?? 0) + line.lineTotal.amountMinor,
    );
  }
  for (const group of updated.supplierGroups) {
    group.subtotal = { ...group.subtotal, amountMinor: perSupplier.get(group.supplierId) ?? 0 };
  }
  for (const budget of updated.budgets) {
    budget.totalMinor = total;
    budget.remainingMinor = budget.budgetMinor - total;
    budget.utilizationPercent =
      budget.budgetMinor === 0 ? 0 : Math.round((total / budget.budgetMinor) * 1000) / 10;
  }
}

export const mockApi: ApiClient = {
  async getHealth() {
    return { status: 'ok', version: '0.1.0-mock' };
  },

  async getSuppliers() {
    return SUPPLIERS;
  },

  async getSupplier(id) {
    const supplier = SUPPLIER_DETAILS.find((candidate) => candidate.id === id);
    if (!supplier) plan404('Supplier', id);
    return supplier;
  },

  async getProducts() {
    return PRODUCTS;
  },

  async getProduct(id) {
    const product = PRODUCT_DETAILS.find((candidate) => candidate.id === id);
    if (!product) plan404('Product', id);
    return product;
  },

  async getInventoryRisk() {
    return INVENTORY_RISK;
  },

  async getPlan(id) {
    if (id !== plan.id) plan404('Plan', id);
    return plan;
  },

  async updatePlanLine(planId, lineId, input) {
    if (planId !== plan.id) plan404('Plan', planId);
    const line = plan.lines.find((candidate) => candidate.id === lineId);
    if (!line) plan404('Plan line', lineId);
    if (input.expectedPlanVersion !== plan.version) {
      throw new ApiError(
        409,
        `Plan version conflict: expected ${input.expectedPlanVersion}, current version is ${plan.version}. Reload before editing.`,
      );
    }

    if (input.selected !== undefined) {
      line.selected = input.selected;
    }
    if (input.editedBaseUnits !== undefined) {
      if (input.editedBaseUnits === null) {
        line.editedBaseUnits = null;
      } else {
        const units = input.editedBaseUnits;
        if (!Number.isInteger(units) || units < 0) {
          throw new ApiError(422, 'Quantity must be a non-negative whole number of base units.');
        }
        if (units % line.purchasePackUnits !== 0) {
          throw new ApiError(
            422,
            `Quantity must be a multiple of the purchase pack (${line.purchasePackUnits} units). Off-pack edits need an approved rounding policy first.`,
          );
        }
        line.editedBaseUnits = units;
      }
    }

    const applied = line.editedBaseUnits ?? line.suggestedBaseUnits;
    line.purchasePackCount = applied / line.purchasePackUnits;
    line.excessUnits = Math.max(0, applied - (line.rawRequiredUnits ?? applied));
    line.lineTotal = {
      amountMinor: applied * line.unitCost.amountMinor,
      currency: line.unitCost.currency,
    };
    plan.version += 1;
    plan.status = 'draft';
    plan.calculationStatus = 'valid';
    recomputeDerived(plan);
    return plan;
  },

  async approvePlan(planId, input) {
    if (planId !== plan.id) plan404('Plan', planId);
    if (input.expectedPlanVersion !== plan.version) {
      throw new ApiError(
        409,
        `Plan version conflict: expected ${input.expectedPlanVersion}, current version is ${plan.version}. Review the latest version before approving.`,
      );
    }
    if (plan.calculationStatus !== 'valid' || plan.blockers.length > 0) {
      throw new ApiError(422, 'This plan cannot be approved until its blockers are resolved.');
    }
    plan.status = 'approved';
    return {
      ...APPROVAL_FIXTURE,
      planVersion: plan.version,
      lineIds: input.lineIds ?? plan.lines.filter((line) => line.selected).map((line) => line.id),
      approvedAt: new Date().toISOString(),
    };
  },

  async getOrders() {
    return ORDERS;
  },

  async getOrder(id) {
    const order = ORDER_DETAILS.find((candidate) => candidate.id === id);
    if (!order) plan404('Purchase order', id);
    return order;
  },

  async previewImport(input) {
    importCounter += 1;
    const id = `IMP-${String(importCounter).padStart(4, '0')}`;
    const mappingComplete = REQUIRED_IMPORT_COLUMNS.every((column) =>
      Boolean(input.mapping?.[column]),
    );
    const preview: ImportPreview = {
      ...fixtureImportPreview(),
      id,
      filename: input.filename,
      dataset: input.dataset,
      mapping: input.mapping ?? {},
      ...(mappingComplete
        ? {
            status: 'valid' as const,
            validRows: 120,
            rejectedRows: 0,
            issues: fixtureImportIssues('warning'),
          }
        : {
            status: 'invalid' as const,
            validRows: 118,
            rejectedRows: 2,
            issues: fixtureImportIssues('all'),
          }),
    };
    importPreviews.set(id, preview);
    return preview;
  },

  async commitImport(importId, _input) {
    const preview = importPreviews.get(importId);
    if (!preview) plan404('Import', importId);
    if (preview.status !== 'valid') {
      throw new ApiError(
        422,
        `Import ${importId} has ${preview.rejectedRows} blocking row issue(s) — resolve them before committing.`,
      );
    }
    return {
      importId,
      status: 'committed',
      resultingVersion: 7,
      totalRows: preview.totalRows,
      importedRows: preview.validRows,
      skippedRows: preview.rejectedRows,
      committedAt: new Date().toISOString(),
    };
  },

  async explain(input) {
    const line = plan.lines.find((candidate) => candidate.id === input.lineId);
    const name = line?.name ?? 'Oat milk';
    return {
      source: 'rule-based',
      text: `${name}: the last 13 days show 4 units/day against 12 units on hand — 3 days of cover with a 5-day lead time, so at least 2 days of demand arrive after the shelf runs dry. Four packs of 12 cover the need at USD 120.00. Delivery timing stays unconfirmed: Oct 18, 2026 is a Sunday and Freshfield Foods delivers Monday–Friday.`,
      model: null,
      fallbackReason:
        'No AI provider is configured in the scaffold — deterministic explanation shown.',
    };
  },
};
