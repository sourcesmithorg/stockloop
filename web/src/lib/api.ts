import { mockApi } from '@/lib/mock';

import { ApiError, type ApiErrorDetail } from './errors';

export { ApiError, isNotFound } from './errors';
export type { ApiErrorDetail } from './errors';

/**
 * StockLoop API contract — mirrors the FastAPI backend on http://localhost:8000
 * (proxied in dev and by nginx in the container). The same `ApiClient`
 * interface is implemented twice: `httpApi` (real) and `mockApi` (fixtures).
 * Select with the single toggle at the bottom: VITE_USE_MOCK=true (default)
 * serves fixtures; =false hits /api.
 *
 * Shapes below mirror api/app/schemas.py field-for-field (camelCase aliases,
 * Decimal serialized as a JSON string, discriminated `kind` unions). An
 * absent value is a distinct "unknown" variant — never a bare zero.
 */

// ---- Money & known-or-unknown shapes -------------------------------------

/** Backend Decimal, serialized as an exact JSON string ("2.50", "384.00"). */
export type DecimalString = string;

/**
 * Discriminated known-or-unknown wrappers: unknown variants carry a reason
 * and are NEVER represented as a bare zero or bare number.
 */
export interface Known<T> {
  kind: 'known';
  value: T;
}

export interface Unknown {
  kind: 'unknown';
  reason: string;
}

export type Maybe<T> = Known<T> | Unknown;

export interface Issue {
  code: string;
  message: string;
}

// ---- Inventory risk view (GET /inventory/risk, embedded in products) ------

export interface StockKnown {
  kind: 'known';
  value: DecimalString;
  unit: string;
  asOf: string;
}

export interface StockUnknown {
  kind: 'unknown';
  reason: string;
}

export type StockValue = StockKnown | StockUnknown;

export interface SalesMeasured {
  kind: 'measured';
  total: DecimalString;
  coveredDays: number;
  windowStart: string;
  windowEnd: string;
}

export interface SalesZeroVerified {
  kind: 'zeroVerified';
  coveredDays: number;
  windowStart: string;
  windowEnd: string;
}

export interface SalesMissing {
  kind: 'missing';
  reason: string;
}

export type SalesValue = SalesMeasured | SalesZeroVerified | SalesMissing;

export interface DemandKnown {
  kind: 'known';
  value: DecimalString;
}

export interface DemandUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type DemandValue = DemandKnown | DemandUnavailable;

export interface CoverFinite {
  kind: 'finite';
  value: DecimalString;
}

export interface CoverNoRecentSales {
  kind: 'noRecentSales';
  reason: string;
}

export interface CoverUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type CoverDaysValue = CoverFinite | CoverNoRecentSales | CoverUnavailable;

export interface LeadKnown {
  kind: 'known';
  value: number;
  unit: string;
  termsVersion: number;
  calendarConfirmed: boolean;
}

export interface LeadUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type LeadTimeValue = LeadKnown | LeadUnavailable;

export interface DepletionKnown {
  kind: 'known';
  date: string;
}

export interface DepletionUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type DepletionValue = DepletionKnown | DepletionUnavailable;

export interface DeliveryKnown {
  kind: 'known';
  date: string;
  /** Calendar lower bound unless confirmed — never a promised slot. */
  confirmed: boolean;
  reason: string;
}

export interface DeliveryUnavailable {
  kind: 'unavailable';
  reason: string;
  confirmed: false;
}

export type DeliveryEstimate = DeliveryKnown | DeliveryUnavailable;

export interface GapFinite {
  kind: 'finite';
  value: DecimalString;
  unit: 'days';
}

export interface GapUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type DeliveryGap = GapFinite | GapUnavailable;

export type RiskState =
  'outOfStock' | 'atRisk' | 'runningLow' | 'healthy' | 'noRecentSales' | 'dataNeeded' | 'stale';

/** Freshness evidence per screen: what data this view was derived from. */
export interface SourceVersions {
  stockSnapshotId: string | null;
  salesThrough: string | null;
  termsVersion: number | null;
  policyVersion: string;
}

export interface InventoryRiskView {
  productId: string;
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  stock: StockValue;
  sales: SalesValue;
  averageDailyDemand: DemandValue;
  coverDays: CoverDaysValue;
  leadTime: LeadTimeValue;
  estimatedDepletion: DepletionValue;
  deliveryEstimate: DeliveryEstimate;
  deliveryGap: DeliveryGap;
  riskState: RiskState;
  blockers: Issue[];
  warnings: Issue[];
  sourceVersions: SourceVersions;
}

// ---- Catalog ---------------------------------------------------------------

export interface SupplierBrief {
  id: string;
  code: string;
  name: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactEmail: string | null;
  documentCurrency: string;
  leadTimeDays: number;
  /** Weekdays as integers (0=Mon … 6=Sun); null = no delivery calendar. */
  deliveryDays: number[] | null;
  calendarConfirmed: boolean;
  lastVerifiedAt: string | null;
  version: number;
}

export interface SupplierTerms {
  id: string;
  supplierId: string;
  unitCost: DecimalString;
  currency: string;
  purchasePackUnits: number;
  minimumOrderUnits: DecimalString;
  leadTimeValue: number;
  leadTimeUnit: string;
  version: number;
}

export interface SalesPoint {
  date: string;
  quantity: DecimalString;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  quantityPrecision: number;
  status: string;
  supplier: SupplierBrief | null;
  terms: SupplierTerms | null;
  risk: InventoryRiskView;
}

export interface ProductDetail extends Product {
  salesSeries: SalesPoint[];
}

// ---- Plans -----------------------------------------------------------------

export type CalculationStatus = 'pending' | 'valid' | 'blocked' | 'failed';

export interface PlanLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  selected: boolean;
  originalSuggestedBaseUnits: DecimalString;
  editedBaseUnits: DecimalString | null;
  effectiveBaseUnits: DecimalString;
  purchasePackUnits: number;
  purchasePackCount: number;
  unitCost: DecimalString;
  currency: string;
  lineTotal: DecimalString;
  termsVersion: number;
  ruleTrace: Record<string, unknown>;
  constraintResults: { code: string; status: string }[];
  explanation: string;
}

/** Per-currency budget view. Tax/shipping are excluded, never zero. */
export interface BudgetStatus {
  currency: string;
  budgetAmount: DecimalString | null;
  selectedTotal: DecimalString;
  remaining: DecimalString | null;
  utilizationPercent: DecimalString | null;
  taxTreatment: string;
  shippingTreatment: string;
}

export interface SupplierGroup {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  currency: string;
  leadTimeDays: number;
  lineCount: number;
  subtotal: DecimalString;
}

export interface PlanSummary {
  id: string;
  version: number;
  calculationStatus: CalculationStatus;
  reviewStatus: string;
  totalsByCurrency: Record<string, DecimalString>;
  activeApprovalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  displayNumber: string;
  supplierId: string;
  supplierName: string;
  currency: string;
  itemSubtotal: DecimalString;
  taxTreatment: string;
  shippingTreatment: string;
  documentStatus: string;
  approvalId: string;
  approvalStatus: string | null;
  planId: string;
  productCount: number;
  totalUnits: DecimalString;
  createdAt: string;
}

export interface Approval {
  id: string;
  planId: string;
  planVersion: number;
  contentDigest: string;
  actorId: string;
  approvedAt: string;
  status: string;
  acknowledgedWarnings: string[];
  orders: OrderSummary[];
}

export interface PlanDetail extends PlanSummary {
  storeId: string;
  policyVersion: string;
  explanationSource: 'ai' | 'rule-based';
  sourceVersions: Record<string, unknown>;
  budgets: BudgetStatus[];
  supplierGroups: SupplierGroup[];
  lines: PlanLine[];
  blockers: Issue[];
  warnings: Issue[];
  activeApproval: Approval | null;
}

export interface UpdatePlanLineInput {
  editedBaseUnits: DecimalString;
  expectedPlanVersion: number;
}

export interface ApprovePlanInput {
  expectedPlanVersion: number;
  acknowledgedWarnings?: string[];
  actorId?: string;
}

// ---- Purchase orders -------------------------------------------------------

export interface OrderLineSnapshot {
  productId: string;
  sku: string;
  productName: string;
  supplierId: string;
  baseUnits: DecimalString;
  purchasePackUnits: number;
  purchasePackCount: number;
  unitCost: DecimalString;
  currency: string;
  lineTotal: DecimalString;
}

export interface OrderDetail extends OrderSummary {
  planVersion: number | null;
  lines: OrderLineSnapshot[];
  supplierSnapshot: Record<string, unknown>;
  disclaimer: string;
}

/**
 * One recorded export attempt. `status` is only ever `succeeded` (document
 * produced) or `failed` (refused). There is no sent/accepted/delivered state —
 * an export produces a file and nothing more. `documentDigest` (sha256) is set
 * only on success, so identical retries share one document identity.
 */
export interface ExportAttempt {
  id: string;
  orderId: string;
  displayNumber: string;
  status: 'succeeded' | 'failed';
  failureCode: string | null;
  failureMessage: string | null;
  documentDigest: string | null;
  documentUrl: string;
  approvalId: string;
  planId: string;
  planVersion: number;
  currency: string;
  attemptedAt: string;
  disclaimer: string;
}

// ---- Imports ---------------------------------------------------------------

/** Backend datasets (app/services/imports.py REQUIRED_COLUMNS). */
export type ImportDataset = 'inventory' | 'sales';

export interface ImportIssue {
  rowNumber: number | null;
  field: string | null;
  issueCode: string;
  severity: string;
  valuePreview: string | null;
  expectedFormat: string | null;
  correctionHint: string | null;
}

export interface ImportCounts {
  totalRows: number;
  validRows: number;
  warningRows: number;
  rejectedRows: number;
}

export interface ImportPreview {
  importId: string;
  dataset: string;
  filename: string;
  byteSize: number;
  sourceDigest: string;
  schemaVersion: string;
  commitPolicy: string;
  /** previewed → validated | blocked; committed after a commit. */
  status: string;
  mapping: Record<string, string>;
  counts: ImportCounts;
  issues: ImportIssue[];
  createdAt: string;
}

export interface PreviewImportInput {
  file: File;
  dataset: ImportDataset;
}

export interface ImportResult {
  importId: string;
  dataset: string;
  status: string;
  appliedRows: number;
  skippedRows: number;
  resultingStoreVersion: number;
  committedAt: string;
}

// ---- AI boundary -----------------------------------------------------------

export interface ExplainInput {
  productId?: string;
  planId?: string;
  language?: string;
  /** 'rule-only' skips the provider and returns the deterministic explanation. */
  mode?: 'auto' | 'rule-only';
}

export interface AiExplanation {
  productId: string;
  sku: string | null;
  summary: string;
  citedInputKeys: string[];
  assumptions: string[];
  riskCodes: string[];
}

/** `source` labels provenance: AI-assisted vs deterministic rule-based. */
export interface AiExplainResponse {
  source: 'ai' | 'rule-based';
  reason: string | null;
  requestId: string;
  planId: string | null;
  planVersion: number | null;
  productId: string | null;
  explanations: AiExplanation[];
}

export interface AiAskInput {
  question: string;
  language?: string;
}

export interface AiCitation {
  field: string;
  value: string;
}

export interface AiProposal {
  productId: string | null;
  title: string;
  field: string;
  currentValue: string;
  proposedValue: string;
}

export interface AiAskResponse {
  answer: string;
  citations: AiCitation[];
  proposals: AiProposal[];
  requestId: string;
  notice: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: { reachable: boolean; latencyMs: number | null; error: string | null };
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
  firstRunComplete: boolean;
}

/** Unset preference fields arrive as null — unknown, never a fabricated default. */
export interface Preferences {
  locale: string | null;
  displayCurrency: string | null;
  timezone: string | null;
  dateFormat: string | null;
  numberFormat: string | null;
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
  /** Explicit one-way onboarding completion (mirrors POST /api/store). */
  completeFirstRun?: boolean;
}

export interface PreferencesUpdateInput {
  locale?: string;
  displayCurrency?: string;
  timezone?: string;
  dateFormat?: string;
  numberFormat?: string;
  expectedVersion: number;
}

export type StoreRole = 'owner' | 'operator' | 'viewer';

export interface StoreMember {
  id: string; // user id
  email: string;
  role: StoreRole;
  status: 'active' | 'revoked';
  createdAt: string; // ISO datetime
}

export interface AddMemberInput {
  email: string;
  role: StoreRole;
}

/** Adding a member records membership only — no email is ever sent. */
export interface MemberResult {
  member: StoreMember;
  notified: false;
  message: string;
}

// ---- Client contract -------------------------------------------------------

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier>;
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<ProductDetail>;
  getInventoryRisk(): Promise<InventoryRiskView[]>;
  getPlans(): Promise<PlanSummary[]>;
  getPlan(id: string): Promise<PlanDetail>;
  updatePlanLine(planId: string, lineId: string, input: UpdatePlanLineInput): Promise<PlanDetail>;
  approvePlan(planId: string, input: ApprovePlanInput): Promise<Approval>;
  getOrders(): Promise<OrderSummary[]>;
  getOrder(id: string): Promise<OrderDetail>;
  exportOrder(id: string, actorId?: string): Promise<ExportAttempt>;
  getOrderExports(id: string): Promise<ExportAttempt[]>;
  previewImport(input: PreviewImportInput): Promise<ImportPreview>;
  commitImport(importId: string): Promise<ImportResult>;
  ask(input: AiAskInput): Promise<AiAskResponse>;
  explain(input: ExplainInput): Promise<AiExplainResponse>;
  login(input: AuthCredentials): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  logout(): Promise<void>;
  me(): Promise<MeOut>;
  getStore(): Promise<StoreWithPreferences>;
  updateStore(input: StoreUpdateInput): Promise<StoreResult>;
  updatePreferences(input: PreferencesUpdateInput): Promise<PreferencesResult>;
  getStoreMembers(): Promise<StoreMember[]>;
  addStoreMember(input: AddMemberInput): Promise<MemberResult>;
  updateStoreMemberRole(userId: string, role: StoreRole): Promise<StoreMember>;
  revokeStoreMember(userId: string): Promise<void>;
}

// ---- HTTP implementation --------------------------------------------------

async function parseError(path: string, response: Response): Promise<never> {
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) await parseError(path, response);
  // 204 No Content (e.g. logout) has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Multipart upload (POST /imports/preview): the browser sets the boundary. */
async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`/api${path}`, {
    body,
    credentials: 'include',
    method: 'POST',
  });
  if (!response.ok) await parseError(path, response);
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
  getPlans: () => request('/plans'),
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
  exportOrder: (id, actorId) =>
    request(`/orders/${encodeURIComponent(id)}/export`, post({ actorId: actorId ?? 'owner' })),
  getOrderExports: (id) => request(`/orders/${encodeURIComponent(id)}/exports`),
  previewImport: ({ file, dataset }) => {
    const body = new FormData();
    body.append('dataset', dataset);
    body.append('file', file);
    return requestForm('/imports/preview', body);
  },
  commitImport: (importId) =>
    request(`/imports/${encodeURIComponent(importId)}/commit`, { method: 'POST' }),
  ask: (input) => request('/ai/ask', post(input)),
  explain: (input) => request('/ai/explain', post(input)),
  login: (input) => request('/auth/login', post(input)),
  register: (input) => request('/auth/register', post(input)),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getStore: () => request('/store'),
  updateStore: (input) => request('/store', post(input)),
  updatePreferences: (input) => request('/preferences', post(input)),
  getStoreMembers: () => request('/store/members'),
  addStoreMember: (input) => request('/store/members', post(input)),
  updateStoreMemberRole: (userId, role) =>
    request(`/store/members/${encodeURIComponent(userId)}`, {
      ...post({ role }),
      method: 'PATCH',
    }),
  revokeStoreMember: (userId) =>
    request(`/store/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
};

/** Single mock/real toggle. Default: fixtures. VITE_USE_MOCK=false → real API. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';

export const api: ApiClient = USE_MOCK ? mockApi : httpApi;
