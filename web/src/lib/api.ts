import { mockApi } from '@/lib/mock';

import { ApiError, type ApiErrorDetail } from './errors';

export { ApiError, isNotFound } from './errors';
export type { ApiErrorDetail } from './errors';

/**
 * StockLoop API contract — mirrors the FastAPI backend on http://localhost:8000
 * (proxied in dev). The same `ApiClient` interface is implemented twice:
 * `httpApi` (real) and `mockApi` (fixtures). Select with the single toggle at
 * the bottom: VITE_USE_MOCK=true (default) serves fixtures; =false hits /api.
 */

// ---- Money & known-or-unknown shapes -------------------------------------

/** Integer minor units + ISO currency. 38400 USD = $384.00. Never a float. */
export interface Money {
  amountMinor: number;
  currency: string;
}

/**
 * Discriminated known-or-unknown wrappers: unknown values carry a reason and
 * are NEVER represented as a bare zero or bare number.
 */
export interface Known<T> {
  kind: 'known';
  value: T;
  asOf?: string;
}

export interface Unknown {
  kind: 'unknown';
  reason: string;
}

export type Maybe<T> = Known<T> | Unknown;

export type StockValue = Maybe<number>;

export type SalesValue =
  | {
      kind: 'measured';
      totalUnits: number;
      coveredDays: number;
      windowStart: string;
      windowEnd: string;
    }
  | { kind: 'zeroVerified'; windowStart: string; windowEnd: string }
  | { kind: 'missing'; reason: string };

export type CoverDaysValue =
  | { kind: 'finite'; days: number }
  | { kind: 'noRecentSales' }
  | { kind: 'unavailable'; reason: string };

export type RiskState =
  'outOfStock' | 'atRisk' | 'runningLow' | 'healthy' | 'noRecentSales' | 'dataNeeded' | 'stale';

/** Calendar lower bound unless explicitly confirmed — never a promised slot. */
export type DeliveryEstimate =
  | { kind: 'estimated'; date: string; confirmed: false; note: string }
  | { kind: 'confirmed'; date: string; confirmed: true }
  | { kind: 'unavailable'; confirmed: false; reason: string };

// ---- Catalog & suppliers --------------------------------------------------

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
}

export interface ProductDetail extends Product {
  stock: StockValue;
  sales: SalesValue;
  coverDays: CoverDaysValue;
  riskState: RiskState;
  supplierTerms: SupplierTerms[];
  dailySales: { date: string; units: number }[];
  estimatedDepletionDays: Maybe<number>;
  deliveryEstimate: DeliveryEstimate;
}

export interface SupplierTerms {
  productId: string;
  supplierId: string;
  unitCost: Money;
  purchasePackUnits: number;
  minimumOrderUnits: number;
  leadTimeDays: number;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  email: string | null;
  documentCurrency: string;
  leadTimeDays: number;
  /** Weekdays this supplier delivers, e.g. ['Mon', … 'Fri']. */
  deliveryDays: string[];
  cutoffTime: string | null;
  lastVerifiedAt: string | null;
}

export interface SupplierDetail extends Supplier {
  terms: SupplierTerms[];
  products: { productId: string; sku: string; name: string }[];
}

export interface InventoryRiskItem {
  productId: string;
  sku: string;
  name: string;
  stock: StockValue;
  sales: SalesValue;
  coverDays: CoverDaysValue;
  averageDailyDemand: Maybe<number>;
  leadTimeDays: Maybe<number>;
  riskState: RiskState;
  blockers: string[];
  warnings: string[];
}

// ---- Restock plan ---------------------------------------------------------

export type PlanStatus = 'draft' | 'reviewed' | 'approved' | 'stale';
export type CalculationStatus = 'pending' | 'valid' | 'blocked' | 'failed';

export interface PlanLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  supplierId: string;
  supplierName: string;
  selected: boolean;
  suggestedBaseUnits: number;
  /** Owner's edit; null = using the suggestion. */
  editedBaseUnits: number | null;
  purchasePackUnits: number;
  purchasePackCount: number;
  /** Raw demand before pack/MOQ rounding; null when not derived by a formula. */
  rawRequiredUnits: number | null;
  /** Units above raw demand from pack/MOQ rounding; null when not derived. */
  excessUnits: number | null;
  unitCost: Money;
  lineTotal: Money;
  deliveryEstimate: DeliveryEstimate;
  explanation: string | null;
}

export interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  currency: string;
  subtotal: Money;
  lineIds: string[];
}

export interface PlanBudget {
  currency: string;
  budgetMinor: number;
  totalMinor: number;
  remainingMinor: number;
  utilizationPercent: number;
  taxIncluded: boolean;
  shippingIncluded: boolean;
}

export interface Plan {
  id: string;
  status: PlanStatus;
  version: number;
  explanationSource: 'ai' | 'rule-based';
  calculationStatus: CalculationStatus;
  lines: PlanLine[];
  supplierGroups: SupplierGroup[];
  budgets: PlanBudget[];
  blockers: string[];
  warnings: string[];
  createdAt: string;
}

export interface UpdatePlanLineInput {
  expectedPlanVersion: number;
  editedBaseUnits?: number | null;
  selected?: boolean;
}

export interface ApprovePlanInput {
  expectedPlanVersion: number;
  lineIds?: string[];
  acknowledgedWarnings?: string[];
}

export interface Approval {
  id: string;
  planId: string;
  planVersion: number;
  lineIds: string[];
  contentDigest: string;
  approvedAt: string;
  actorId: string;
}

// ---- Purchase orders ------------------------------------------------------

export type DocumentStatus = 'draft' | 'ready' | 'exported' | 'stale';

export interface PurchaseOrder {
  id: string;
  displayNumber: string;
  supplierId: string;
  supplierName: string;
  currency: string;
  documentStatus: DocumentStatus;
  itemSubtotal: Money;
  taxTreatment: string;
  shippingTreatment: string;
  createdAt: string;
  approvalId: string;
  sourcePlanVersion: number;
}

export interface OrderLine {
  productId: string;
  sku: string;
  name: string;
  baseUnits: number;
  purchasePackUnits: number;
  purchasePackCount: number;
  unitCost: Money;
  lineTotal: Money;
}

export interface ExportAttempt {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'unknown';
  startedAt: string;
  completedAt: string | null;
  artifactName: string | null;
  failureCode: string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: OrderLine[];
  exports: ExportAttempt[];
}

// ---- Imports --------------------------------------------------------------

export type ImportDataset = 'stock' | 'sales' | 'products' | 'suppliers';
export type ImportStatus = 'mapping' | 'validating' | 'valid' | 'invalid' | 'committed';

export interface PreviewImportInput {
  dataset: ImportDataset;
  filename: string;
  content?: string;
  mapping?: Record<string, string>;
}

export interface ImportIssue {
  rowNumber: number;
  field: string;
  issueCode: string;
  severity: 'blocking' | 'warning';
  /** Pre-redacted preview of the offending value; treat as untrusted text. */
  valuePreview: string;
  expectedFormat: string;
  correctionHint: string;
}

export interface ImportPreview {
  id: string;
  dataset: ImportDataset;
  filename: string;
  status: ImportStatus;
  availableColumns: string[];
  requiredColumns: string[];
  mapping: Record<string, string>;
  totalRows: number;
  validRows: number;
  warningRows: number;
  rejectedRows: number;
  issues: ImportIssue[];
}

export interface CommitImportInput {
  idempotencyKey: string;
}

export interface ImportResult {
  importId: string;
  status: 'committed';
  resultingVersion: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  committedAt: string;
}

// ---- AI boundary ----------------------------------------------------------

export interface ExplainInput {
  question: string;
  planId?: string;
  planVersion?: number;
  lineId?: string;
  productId?: string;
}

/** `source` labels the provenance: AI-assisted vs deterministic explanation. */
export interface ExplainResponse {
  source: 'ai' | 'rule-based';
  text: string;
  model: string | null;
  fallbackReason: string | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
}

// ---- Auth, store & preferences -------------------------------------------

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Store {
  id: string;
  name: string;
  countryCode: string;
  locale: string;
  defaultCurrency: string;
  timezone: string;
  version: number;
}

export interface Preferences {
  locale: string;
  displayCurrency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  version: number;
}

/** GET /api/auth/me — the session snapshot the guard renders from. */
export interface MeOut {
  user: User;
  store: Store;
  preferences: Preferences;
  firstRunComplete: boolean;
}

export interface AuthResult {
  user: User;
  store: Store;
  preferences: Preferences;
}

export interface StoreWithPreferences {
  store: Store;
  preferences: Preferences;
}

export interface StoreResult {
  store: Store;
  version: number;
}

export interface PreferencesResult {
  preferences: Preferences;
  version: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  storeName: string;
  country: string;
  language: string;
  currency: string;
  timezone: string;
}

export interface StoreUpdateInput {
  name?: string;
  country?: string;
  locale?: string;
  defaultCurrency?: string;
  timezone?: string;
  expectedVersion: number;
}

export interface PreferencesUpdateInput {
  locale?: string;
  displayCurrency?: string;
  timezone?: string;
  dateFormat?: string;
  numberFormat?: string;
  expectedVersion: number;
}

// ---- Client contract ------------------------------------------------------

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<SupplierDetail>;
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<ProductDetail>;
  getInventoryRisk(): Promise<InventoryRiskItem[]>;
  getPlan(id: string): Promise<Plan>;
  updatePlanLine(planId: string, lineId: string, input: UpdatePlanLineInput): Promise<Plan>;
  approvePlan(planId: string, input: ApprovePlanInput): Promise<Approval>;
  getOrders(): Promise<PurchaseOrder[]>;
  getOrder(id: string): Promise<PurchaseOrderDetail>;
  previewImport(input: PreviewImportInput): Promise<ImportPreview>;
  commitImport(importId: string, input: CommitImportInput): Promise<ImportResult>;
  explain(input: ExplainInput): Promise<ExplainResponse>;
  login(input: AuthCredentials): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  logout(): Promise<void>;
  me(): Promise<MeOut>;
  getStore(): Promise<StoreWithPreferences>;
  updateStore(input: StoreUpdateInput): Promise<StoreResult>;
  updatePreferences(input: PreferencesUpdateInput): Promise<PreferencesResult>;
}

// ---- HTTP implementation --------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    // Errors follow the {detail: {code, message, field?, currentVersion?}}
    // envelope; a non-JSON body (proxy/HTML) falls back to the status line.
    let detail: ApiErrorDetail | undefined;
    try {
      const body = (await response.json()) as { detail?: ApiErrorDetail };
      detail = body.detail;
    } catch {
      // No JSON body to parse — keep the generic status message.
    }
    throw new ApiError(
      response.status,
      detail?.message ?? `${response.status} ${response.statusText} on ${path}`,
      detail,
    );
  }
  // 204 No Content (e.g. logout) has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const httpApi: ApiClient = {
  getHealth: () => request('/health'),
  getSuppliers: () => request('/suppliers'),
  getSupplier: (id) => request(`/suppliers/${encodeURIComponent(id)}`),
  getProducts: () => request('/products'),
  getProduct: (id) => request(`/products/${encodeURIComponent(id)}`),
  getInventoryRisk: () => request('/inventory/risk'),
  getPlan: (id) => request(`/plans/${encodeURIComponent(id)}`),
  updatePlanLine: (planId, lineId, input) =>
    request(
      `/plans/${encodeURIComponent(planId)}/lines/${encodeURIComponent(lineId)}`,
      post(input),
    ),
  approvePlan: (planId, input) =>
    request(`/plans/${encodeURIComponent(planId)}/approve`, post(input)),
  getOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${encodeURIComponent(id)}`),
  previewImport: (input) => request('/imports/preview', post(input)),
  commitImport: (importId, input) =>
    request(`/imports/${encodeURIComponent(importId)}/commit`, post(input)),
  explain: (input) => request('/ai/explain', post(input)),
  login: (input) => request('/auth/login', post(input)),
  register: (input) => request('/auth/register', post(input)),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getStore: () => request('/store'),
  updateStore: (input) => request('/store', post(input)),
  updatePreferences: (input) => request('/preferences', post(input)),
};

/** Single mock/real toggle. Default: fixtures. VITE_USE_MOCK=false → real API. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';

export const api: ApiClient = USE_MOCK ? mockApi : httpApi;
