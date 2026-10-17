"""API response/request schemas — the frontend contract.

All money and quantity values serialize as JSON strings (exact decimals).
Unknown values are discriminated unions (`kind` field), never bare numbers or nulls.
Field aliases are camelCase (populate_by_name allows snake_case too).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.domain.calculations import RiskState


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# --------------------------------------------------------------------------- issues


class Issue(BaseModel):
    code: str
    message: str


# --------------------------------------------------------------------------- risk view


class StockKnown(BaseModel):
    kind: Literal["known"] = "known"
    value: Decimal
    unit: str
    asOf: date


class StockUnknown(BaseModel):
    kind: Literal["unknown"] = "unknown"
    reason: str


StockUnion = Annotated[StockKnown | StockUnknown, Field(discriminator="kind")]


class SalesMeasured(BaseModel):
    kind: Literal["measured"] = "measured"
    total: Decimal
    coveredDays: int
    windowStart: date
    windowEnd: date


class SalesZeroVerified(BaseModel):
    kind: Literal["zeroVerified"] = "zeroVerified"
    coveredDays: int
    windowStart: date
    windowEnd: date


class SalesMissing(BaseModel):
    kind: Literal["missing"] = "missing"
    reason: str


SalesUnion = Annotated[
    SalesMeasured | SalesZeroVerified | SalesMissing, Field(discriminator="kind")
]


class DemandKnown(BaseModel):
    kind: Literal["known"] = "known"
    value: Decimal


class DemandUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str


DemandUnion = Annotated[DemandKnown | DemandUnavailable, Field(discriminator="kind")]


class CoverFinite(BaseModel):
    kind: Literal["finite"] = "finite"
    value: Decimal


class CoverNoRecentSales(BaseModel):
    kind: Literal["noRecentSales"] = "noRecentSales"
    reason: str


class CoverUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str


CoverUnion = Annotated[
    CoverFinite | CoverNoRecentSales | CoverUnavailable, Field(discriminator="kind")
]


class LeadKnown(BaseModel):
    kind: Literal["known"] = "known"
    value: int
    unit: str
    termsVersion: int
    calendarConfirmed: bool


class LeadUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str


LeadUnion = Annotated[LeadKnown | LeadUnavailable, Field(discriminator="kind")]


class DepletionKnown(BaseModel):
    kind: Literal["known"] = "known"
    date: date


class DepletionUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str


DepletionUnion = Annotated[DepletionKnown | DepletionUnavailable, Field(discriminator="kind")]


class DeliveryKnown(BaseModel):
    kind: Literal["known"] = "known"
    date: date
    confirmed: bool
    reason: str


class DeliveryUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str
    confirmed: bool = False


DeliveryUnion = Annotated[DeliveryKnown | DeliveryUnavailable, Field(discriminator="kind")]


class GapFinite(BaseModel):
    kind: Literal["finite"] = "finite"
    value: Decimal
    unit: Literal["days"] = "days"


class GapUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str


GapUnion = Annotated[GapFinite | GapUnavailable, Field(discriminator="kind")]


class SourceVersions(BaseModel):
    stockSnapshotId: str | None = None
    salesThrough: date | None = None
    termsVersion: int | None = None
    policyVersion: str


class InventoryRiskView(BaseModel):
    productId: str
    sku: str
    name: str
    category: str
    baseUnit: str
    stock: StockUnion
    sales: SalesUnion
    averageDailyDemand: DemandUnion
    coverDays: CoverUnion
    leadTime: LeadUnion
    estimatedDepletion: DepletionUnion
    deliveryEstimate: DeliveryUnion
    deliveryGap: GapUnion
    riskState: RiskState
    blockers: list[Issue] = Field(default_factory=list)
    warnings: list[Issue] = Field(default_factory=list)
    sourceVersions: SourceVersions


# --------------------------------------------------------------------------- catalog


class SupplierBrief(BaseModel):
    id: str
    code: str
    name: str


class SupplierOut(ApiModel, SupplierBrief):
    contactEmail: str | None = None
    documentCurrency: str
    leadTimeDays: int
    deliveryDays: list[int] | None = None
    calendarConfirmed: bool
    lastVerifiedAt: date | None = None
    version: int


class TermsOut(ApiModel):
    id: str
    supplierId: str
    unitCost: Decimal
    currency: str
    purchasePackUnits: int
    minimumOrderUnits: Decimal
    leadTimeValue: int
    leadTimeUnit: str
    version: int


class SalesPointOut(ApiModel):
    date: date
    quantity: Decimal


class ProductOut(ApiModel):
    id: str
    sku: str
    name: str
    category: str
    baseUnit: str
    quantityPrecision: int
    status: str
    supplier: SupplierBrief | None = None
    terms: TermsOut | None = None
    risk: InventoryRiskView


class ProductDetailOut(ProductOut):
    salesSeries: list[SalesPointOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- health


class DbHealth(BaseModel):
    reachable: bool
    latencyMs: int | None = None
    error: str | None = None


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    db: DbHealth
    version: str


# --------------------------------------------------------------------------- plans


class PlanLineOut(ApiModel):
    id: str
    productId: str
    sku: str
    productName: str
    supplierId: str
    supplierName: str
    selected: bool
    originalSuggestedBaseUnits: Decimal
    editedBaseUnits: Decimal | None = None
    effectiveBaseUnits: Decimal
    purchasePackUnits: int
    purchasePackCount: int
    unitCost: Decimal
    currency: str
    lineTotal: Decimal
    termsVersion: int
    ruleTrace: dict[str, Any]
    constraintResults: list[dict[str, Any]]
    explanation: str


class BudgetStatus(ApiModel):
    currency: str
    budgetAmount: Decimal | None = None
    selectedTotal: Decimal
    remaining: Decimal | None = None
    utilizationPercent: Decimal | None = None
    taxTreatment: str = "excluded"
    shippingTreatment: str = "excluded"


class SupplierGroupOut(ApiModel):
    supplierId: str
    supplierCode: str
    supplierName: str
    currency: str
    leadTimeDays: int
    lineCount: int
    subtotal: Decimal


class OrderLineSnapshot(ApiModel):
    productId: str
    sku: str
    productName: str
    supplierId: str
    baseUnits: Decimal
    purchasePackUnits: int
    purchasePackCount: int
    unitCost: Decimal
    currency: str
    lineTotal: Decimal


class OrderSummary(ApiModel):
    id: str
    displayNumber: str
    supplierId: str
    supplierName: str
    currency: str
    itemSubtotal: Decimal
    taxTreatment: str
    shippingTreatment: str
    documentStatus: str
    approvalId: str
    approvalStatus: str | None = None
    planId: str
    productCount: int
    totalUnits: Decimal
    createdAt: datetime


class OrderDetailOut(OrderSummary):
    planVersion: int | None = None
    lines: list[OrderLineSnapshot]
    supplierSnapshot: dict[str, Any]
    disclaimer: str


class ApprovalOut(ApiModel):
    id: str
    planId: str
    planVersion: int
    contentDigest: str
    actorId: str
    approvedAt: datetime
    status: str
    acknowledgedWarnings: list[str]
    orders: list[OrderSummary] = Field(default_factory=list)


class ExportRequest(BaseModel):
    actorId: str = "owner"


class ExportAttemptOut(ApiModel):
    """One export attempt. `succeeded` means the document was produced and is
    retrievable at documentUrl — never that the supplier received or accepted
    anything.
    """

    id: str
    orderId: str
    displayNumber: str
    status: str
    failureCode: str | None = None
    failureMessage: str | None = None
    documentDigest: str | None = None
    documentUrl: str
    approvalId: str
    planId: str
    planVersion: int
    currency: str
    attemptedAt: datetime
    disclaimer: str


class PlanDetailOut(ApiModel):
    id: str
    storeId: str
    version: int
    calculationStatus: str
    reviewStatus: str
    policyVersion: str
    explanationSource: str
    sourceVersions: dict[str, Any]
    totalsByCurrency: dict[str, Decimal]
    budgets: list[BudgetStatus]
    supplierGroups: list[SupplierGroupOut]
    lines: list[PlanLineOut]
    blockers: list[Issue]
    warnings: list[Issue]
    activeApproval: ApprovalOut | None = None
    createdAt: datetime
    updatedAt: datetime


class PlanSummaryOut(ApiModel):
    id: str
    version: int
    calculationStatus: str
    reviewStatus: str
    totalsByCurrency: dict[str, Decimal]
    activeApprovalId: str | None = None
    createdAt: datetime
    updatedAt: datetime


class EditLineRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    editedBaseUnits: Decimal
    expectedPlanVersion: int


class ApproveRequest(BaseModel):
    expectedPlanVersion: int
    acknowledgedWarnings: list[str] = Field(default_factory=list)
    actorId: str = "owner"


# --------------------------------------------------------------------------- imports


class ImportIssueOut(ApiModel):
    rowNumber: int | None = None
    field: str | None = None
    issueCode: str
    severity: str
    valuePreview: str | None = None
    expectedFormat: str | None = None
    correctionHint: str | None = None


class ImportCounts(BaseModel):
    totalRows: int
    validRows: int
    warningRows: int
    rejectedRows: int


class ImportPreviewOut(ApiModel):
    importId: str
    dataset: str
    filename: str
    byteSize: int
    sourceDigest: str
    schemaVersion: str
    commitPolicy: str
    status: str
    mapping: dict[str, str]
    counts: ImportCounts
    issues: list[ImportIssueOut]
    createdAt: datetime


class ImportCommitOut(ApiModel):
    importId: str
    dataset: str
    status: str
    appliedRows: int
    skippedRows: int
    resultingStoreVersion: int
    committedAt: datetime


# --------------------------------------------------------------------------- AI


class AiExplainRequest(BaseModel):
    productId: str | None = None
    planId: str | None = None
    language: str | None = None
    # rule-only: skip the provider entirely and return the deterministic explanation.
    mode: Literal["auto", "rule-only"] = "auto"

    @model_validator(mode="after")
    def _require_context(self) -> AiExplainRequest:
        if not self.productId and not self.planId:
            raise ValueError("productId or planId is required")
        return self


class AiExplanation(BaseModel):
    productId: str
    sku: str | None = None
    summary: str
    citedInputKeys: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    riskCodes: list[str] = Field(default_factory=list)


class AiExplainResponse(BaseModel):
    source: Literal["ai", "rule-based"]
    reason: str | None = None
    requestId: str
    planId: str | None = None
    planVersion: int | None = None
    productId: str | None = None
    explanations: list[AiExplanation]


class AiAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    language: str | None = None


class AiCitation(BaseModel):
    """One figure quoted from the server snapshot: source field + its value."""

    field: str
    value: str


class AiProposal(BaseModel):
    """Inert draft change the owner could make. Carries the value it would
    change; applying it goes through the normal review screen. Never executed."""

    productId: str | None = None
    title: str
    field: str
    currentValue: str
    proposedValue: str


class AiAskResponse(BaseModel):
    answer: str
    citations: list[AiCitation] = Field(default_factory=list)
    proposals: list[AiProposal] = Field(default_factory=list)
    requestId: str
    notice: str


# --------------------------------------------------------------------------- auth & account


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    storeName: str = Field(min_length=1, max_length=200)
    country: str = Field(min_length=2, max_length=2)
    language: str = Field(min_length=1, max_length=16)
    currency: str = Field(min_length=3, max_length=3)
    timezone: str = Field(min_length=1, max_length=64)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    role: str


class StoreOut(ApiModel):
    id: str
    name: str
    countryCode: str
    locale: str
    defaultCurrency: str
    timezone: str
    version: int
    firstRunComplete: bool


class PreferencesOut(ApiModel):
    locale: str | None = None
    displayCurrency: str | None = None
    timezone: str | None = None
    dateFormat: str | None = None
    numberFormat: str | None = None
    version: int


class PreferencesUpdate(BaseModel):
    locale: str | None = None
    displayCurrency: str | None = None
    timezone: str | None = None
    dateFormat: str | None = None
    numberFormat: str | None = None
    expectedVersion: int | None = None


class PreferencesResult(BaseModel):
    preferences: PreferencesOut
    version: int


class StoreUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    locale: str | None = None
    defaultCurrency: str | None = None
    timezone: str | None = None
    expectedVersion: int | None = None
    # Explicit onboarding completion: true flips store.first_run_complete (one-way).
    completeFirstRun: bool = False


class StoreResult(BaseModel):
    store: StoreOut
    version: int


class StoreWithPreferences(BaseModel):
    store: StoreOut
    preferences: PreferencesOut


class AuthResult(BaseModel):
    user: UserOut
    store: StoreOut
    preferences: PreferencesOut


class MeOut(BaseModel):
    user: UserOut
    store: StoreOut
    preferences: PreferencesOut
    firstRunComplete: bool


# --------------------------------------------------------------------------- store members


class MemberOut(ApiModel):
    id: str  # user id
    email: str
    role: str
    status: str
    createdAt: datetime


class MemberAddRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    role: str = Field(min_length=1, max_length=24)


class MemberRoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=24)


class MemberResult(ApiModel):
    member: MemberOut
    # Always false: there is no mail infrastructure and none is authorized.
    # The API records the membership; nobody is contacted.
    notified: bool = False
    message: str
