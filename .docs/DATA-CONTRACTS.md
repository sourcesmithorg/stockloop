# StockLoop domain and UI data contracts

Status: PROPOSED framework-neutral contracts. These are logical records, not a deployed database schema, API or Convex implementation. Resolve policy decisions before making them authoritative.

## Global conventions

- Stable opaque IDs, separately displayed business codes such as SKU/PO number. Never use a name as identity.
- Every operational record belongs to a store. Trusted reads/mutations verify membership; a client-provided store ID is not sufficient authorization.
- Store timestamps as UTC instants; retain IANA store timezone for interpreting reporting dates/cutoffs. A business date is not interchangeable with an instant.
- Quantities carry base unit and approved precision. Most fixture goods use integer `each`; fractional stock needs an explicit policy and unit model.
- Money carries ISO currency and decimal/minor-unit precision. Use exact decimal arithmetic or carefully validated integer minor units. Do not assume all currencies have two decimals.
- Missing values use null plus a reason/state, not numeric zero. Unknown and verified zero are distinct.
- Version records and retain source provenance. Approval targets immutable content and relevant source versions, not mutable UI state.
- User/supplier/import/model text is escaped data. Do not render arbitrary HTML or execute suggested links/actions.

## Store and membership

| Record | Fields | Important invariants |
|---|---|---|
| Store | id, name, countryCode, locale, defaultCurrency, timezone, createdAt, version | Region choices independent; no automatic historical conversion |
| Membership | storeId, userId, role, status, version | Permissions verified at trusted boundary |
| Preferences | storeId/userId scope, locale, display preferences, version | Scope of overrides requires policy; changes do not rewrite documents |
| PurchasingPolicy | storeId, demandWindow, targetDays, safetyDays, budgetByCurrency, roundingPolicy, warningPolicy, version | Versioned and owner-authorized; defaults are not hidden |

## Catalog and supplier terms

| Record | Fields | Important invariants |
|---|---|---|
| Product | id, storeId, sku, name, category, baseUnit, quantityPrecision, status | SKU uniqueness within store; archive rather than break historic documents |
| Supplier | id, storeId, name, contact, documentCurrency, deliveryCalendar, cutoff, lastVerifiedAt, version | Currency/calendar not inferred from name/address |
| ProductSupplierTerms | productId, supplierId, unitCost, priceBaseUnit, purchasePackUnits, minimumOrderUnits, leadTimeValue, leadTimeUnit, version | Positive pack; MOQ compatible with unit policy; explicit calendar versus business-day lead time |

A product may have multiple supplier relationships later; MVP selection policy is OPEN. Do not silently pick the cheapest one or clone items across suppliers. Prices can expire; price validity/cutoff policy belongs to D-09/D-11.

## Source data

**StockSnapshot:** id, storeId, productId, quantity or unknownReason, baseUnit, asOf, importedAt, importId, sourceVersion. Snapshot replacement is not stock movement unless explicitly modeled.

**SalesRecord:** id, storeId, productId, businessDate/reporting interval, quantitySold, quantityReturned if adopted, source key, importId, sourceVersion. Returns/voids and overlapping imports require D-06/D-07. Do not append duplicate daily totals silently.

**ReportingCoverage:** storeId, productId/dataset, startDate, endDate, expectedPeriods, observedPeriods, explicitZeroPeriods, gaps, timezone, sourceVersion. Missing dates cannot automatically become zero sales.

**ImportJob:** id, storeId, dataset, filename, byteSize, sourceDigest, schemaVersion, mapping, localeFormats, status, totalRows, validRows, warningRows, rejectedRows, commitPolicy, importActor, timestamps, resultingVersion, idempotencyKey.

**ImportIssue:** importId, rowNumber, field, issueCode, severity (`blocking`/`warning`), safe valuePreview, expectedFormat, correctionHint. A row may have several issues; issue count and rejected-row count are not interchangeable.

## Derived risk view, not a second source of truth

```text
InventoryRiskView
  productIdentity
  stock: known(value, unit, asOf) | unknown(reason)
  sales: measured(total, coveredDays, window) | zeroVerified(window) | missing(reason)
  averageDailyDemand: value | unavailable(reason)
  coverDays: finite(value) | noRecentSales | unavailable(reason)
  leadTime: value, unit, termsVersion, calendarConfirmed
  estimatedDepletion: value | unavailable(reason)
  deliveryEstimate: date/instant | unavailable(reason), confirmed: boolean
  deliveryGap: value | unavailable(reason)
  riskState: outOfStock | atRisk | runningLow | healthy | noRecentSales | dataNeeded | stale
  blockers[] and warnings[]
  sourceVersions and policyVersion
```

Risk thresholds are business policy, not CSS colors. The UI renders labels from states; it cannot decide eligibility by whether a pill is red or green.

## Plan and lines

**Plan:** id, storeId, status, version, sourceVersions, policyVersion, createdBy/At, explanationSource, budgetByCurrency, totalsByCurrency, supplierGroups, calculationStatus, blockers/warnings.

**PlanLine:** id, planId, productId, supplierId, selected, originalSuggestedBaseUnits, editedBaseUnits, purchasePackUnits, purchasePackCount, unitCost snapshot, currency, lineTotal, termsVersion, ruleTrace, constraintResults, explanation.

Proposed state fields separate calculation (`pending`, `valid`, `blocked`, `failed`) from review (`draft`, `reviewed`, `approved`, `stale`). These should not be one overloaded status. A valid calculation is not approval.

A zero selected quantity follows explicit exclusion policy. Off-pack edits cannot create fractional purchase cases accidentally. Every derived line total is recomputed using trusted validated values, not accepted from browser input.

## Approval and documents

**Approval:** id, storeId, planId, planVersion, approvedGroupIds/lineIds, contentDigest, sourceVersions, termsVersions, policyVersion, actorId, approvedAt, acknowledgedWarnings, status/revocationReason.

**PurchaseOrder:** id, storeId, displayNumber, supplierId, currency, immutableApprovedLines, itemSubtotal, taxTreatment, shippingTreatment, approvedVersion/contentDigest, approvalId, documentStatus, createdAt, originalPartySnapshot.

Do not retroactively update a historic document's supplier address, cost or currency after profile edits. Preserve historic snapshot facts and separately show current contact/terms when relevant.

**ExportAttempt:** id, orderId, approvedVersion, actorId, status, idempotencyKey, startedAt, completedAt, artifactReference, contentDigest, failureCode. Failed and unknown attempts differ. Provider artifact storage URLs need access controls and retention policy.

Supplier email is not part of this core contract. It would need a separate communication record and send authorization; see [OPTIONAL-EXTENSIONS.md](OPTIONAL-EXTENSIONS.md).

## Mutation contracts, illustrative names

These are conceptual operations, not existing endpoints/functions:

| Operation | Preconditions | Atomic outcome | UI recovery |
|---|---|---|---|
| Save preferences | Membership, valid codes, expectedVersion | New preferences version | Retain dirty fields on failure/conflict |
| Commit import | Validated job, approved commit policy, digest/idempotency | Data version plus committed job, or no commit | Reconcile attempt before retry |
| Update plan quantity | Permission, expectedPlanVersion, valid quantity | New plan version/recalculation; approval stale | Show latest version or resolve edit conflict |
| Approve group | Authorized owner, current versions, valid constraints | Immutable approval for exact group/version | Reject stale/blocking review with reason |
| Export document | Authorized actor, current eligible approval/version | Attempt/artifact for reviewed content | Preserve document; retry/reconcile safely |

## Concurrency and idempotency

- Use expected versions for mutable saves. Never overwrite newer input without deliberate conflict resolution.
- Approve/export against trusted versions in the same consistency boundary as eligibility validation.
- New imports/terms/policy or line edits invalidate affected eligibility. Historical approvals remain audit records, not current permission to export a changed plan.
- Generate/reuse operation keys appropriate to retries. A timeout means unknown until reconciled, not automatic failure or success.
- If a provider operation cannot be transactionally coupled to storage, use an explicit attempt/job lifecycle and reconcile events. Do not use a client timeout as evidence that nothing happened.

## UI query models

Prefer bounded views for overview counters, paginated inventory, product inputs, supplier readiness, import result, plan review and order document. Counts and currency totals should be computed from consistent source versions. Do not recompute finance state in multiple components using inconsistent rules.

If Convex is selected, map these logical records to indexed tables and small typed queries/mutations/actions with store-scoped authorization. External AI/export calls belong in provider-facing actions, with validated results passed through trusted mutations. This paragraph is guidance, not a scaffold or a promise of generated APIs.
