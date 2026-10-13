# StockLoop acceptance-test catalog

These are test specifications for future authorized work, not assertions that an application exists or that these tests have run. The existing template's actual checks are in [BASELINE.md](BASELINE.md). Each implementation task should select applicable tests and report pass/fail/not-run with evidence.

## UI and identity

### T-01: correct record routes

Given two products/suppliers/orders, when opening a row, then detail identity, supplier, currency and amount match that row. A missing detail fixture is plain text or explicitly labeled as another example. Regression: Daily Goods PO-2026-0143 must not open Freshfield PO-2026-0142 USD240.

### T-02: responsive containment

At 1440/768/390/320 CSS pixels and 200% text zoom, whole-page horizontal overflow is absent, key quantities/blockers/actions remain accessible and long names wrap. Dense tables may scroll inside their labeled region. Verify actual user access to trailing columns, not just document width.

### T-03: keyboard and semantics

Skip link is first useful focus; one h1/main; navigation current state accurate; fields labeled; disclosures operable; tables have captions/scoped headers; focus visible; no keyboard trap. Status conveyed with text, not color alone.

### T-04: interaction/state presentation

Loading, empty inventory, empty search, error, offline and success are distinct. Reduced-motion disables decorative/skeleton animation; forced-colors retains boundaries and focus. Disabled mutations explain why. German/Arabic samples expose correct language/direction.

## Account, regions and persistence

### T-05: region defaults and persistence

New setup starts English/USD. Select Indonesia/Indonesian/IDR and a valid IANA timezone; save/reload retains choices. Country change alone does not silently change currency. Unsupported translation fallback is explained.

### T-06: failed/dirty save

Edit settings, simulate service failure, then input remains and save error/retry is shown. Navigate away with genuine dirty state: warn as specified. Reopen after successful save: persisted value matches. A fixture link cannot count as save evidence.

## Imports

### T-07: missing mapping

Given a sales file without mapped SKU, continue is blocked with field-associated error. Map correctly and revalidate: continuation enables only after validation. Screen-reader announcement/error summary exposes the blocker.

### T-08: validation and counts

Given invalid quantity/date, duplicate key and unknown supplier, show row/field/reason/severity. Distinguish issue count from rejected-row count. Valid + rejected unique rows reconcile with total under the chosen commit policy. No success while blockers remain.

### T-09: import atomicity and retries

Under atomic policy, failed commit changes no data. Under approved partial policy, accepted/rejected rows are explicit. Retry/double-click/replayed file cannot duplicate sales or misapply snapshot changes. Timeout outcome is reconciled before a new commit attempt.

### T-10: missing/zero/stale source

Missing sales date/history is not zero. A complete zero-sales window renders no-recent-sales, not infinite cover. Unknown stock/cost/lead time blocks affected estimates/lines as required. Stale sources show dates and require applicable revalidation.

## Deterministic calculations

### T-11: stock cover and SKU chart

Complete oat-milk fixture: 12 stock, 52 sales/13 days, average4, cover3. Chart values match the SKU/window. Zero/missing demand cannot produce NaN/infinity or a fabricated healthy state. Other rows are not assumed outputs of the same formula without complete inputs.

### T-12: delivery calendar and gap

Oct13 + five calendar days is Sunday Oct18, 2026. For weekday-only supplier, show unconfirmed estimate or valid calendar-adjusted date. Do not call Sunday earliest regular delivery. Increasing quantity leaves the timing gap visible.

### T-13: packs and MOQ

Raw demand17, pack12, MOQ24 produces24 units/two packs and explains7 excess units. Demand0 does not create an MOQ purchase. Negative, fractional or off-pack edits follow approved policy and cannot reach approval silently.

### T-14: exact fixture totals

Oat48×2.50=120; rice30×4=120; noodles96×0.75=72; water48×1.50=72. Total384; supplier240/144; budget500; remaining116; utilization76.8%. UI and export agree. Tax/shipping excluded is not equivalent to zero cost.

### T-15: currency/precision/budget

USD and EUR lines never form one unconverted trusted total. Test currencies with zero/two/three decimals under selected rounding rules. Budget shortage shows shortfall and uncovered risks; no silent product deletion or quantity changes. Preference change does not relabel historical money.

## AI

### T-16: invalid/injected/stale AI

Model output with unknown SKU, invalid quantity, contradictory confirmed-delivery claim or embedded instruction is rejected/filtered. Supplier and CSV text remains untrusted data and cannot trigger secret access or external actions. A response for plan version 1 arriving after version 2 is not current approval-ready advice.

### T-17: provider failure/fallback

Timeout/quota/refusal/malformed output shows safe failure and rule-based explanation. Current deterministic plan remains reviewable. Fallback never masquerades as Gemini/AI output. No raw credentials/provider stack trace enters UI.

## Approval, documents and concurrency

### T-18: approval and export eligibility

Only authorized actor can approve exact valid current version. Blocking constraints prevent approval/export at trusted service boundary even if client controls are bypassed. Documents are one supplier/currency and match approved quantities. Exported artifact status never implies order placed.

### T-19: edit invalidates approval

Approve planv1, edit quantity/cost/budget/relevant policy, then new version requires review and stale approval cannot export changed content. A pending/failed recalculation cannot retain old eligibility. Historical approval remains auditable.

### T-20: store isolation and permissions

Actor from storeA cannot read/mutate storeB by modifying IDs. Viewer/operator permissions follow approved policy; a disabled button is not sufficient enforcement. Expired session and membership revocation yield safe recoverable UI.

### T-21: concurrent input and operation retries

Two actors edit one plan: stale expectedVersion is rejected, not silently overwritten. Import/terms change during approval/export causes trusted conflict/revalidation. Duplicate requests and ambiguous external outcomes reconcile without unintended duplicate artifacts/commits.

## Inclusion and release

### T-22: localization and timezones

English/USD defaults; long translated strings wrap; Arabic RTL; correct `lang`; script font fallback. Dates/cutoffs use store timezone, including DST transitions. Changing timezone cannot reinterpret immutable historical instants silently. Locale number/date parsing requires explicit format.

### T-23: scoped counts and provenance

Four restock suggestions are labeled as suggestions, not all attention items when an out-of-stock SKU also exists. Overview/query counts disclose scope. Source times/windows/versions visible. Demo metrics cannot appear as actual store measurements.

### T-24: component extraction parity

Ported shell/buttons/fields/pills/tables/rail retain tokens, behavior and accessibility. Correct detail links, budget-meter semantics, navigation landmarks, quantity labels and validation descriptions survive framework slicing. Assets/font license retained.

### T-25: document rendering and export recovery

A4/PDF fixture includes line items, subtotal, party identity, currency, delivery notes/version and demo disclaimer when applicable. Shell/skip link absent in print. Failed export preserves preview/approval and offers safe retry. Artifact retrieval restricted to authorized store. Do not shrink essential content into unreadability to meet one-page goal for larger real orders; paginate them properly.

## Test levels

- Domain unit/property tests: calculations, precision, unknown propagation, packs/currency separation.
- Service integration tests: permissions, version preconditions, import atomicity/idempotency, approval/export guards.
- Component/browser tests: states, routes, labels, focus, viewport containment and interactive transitions.
- Manual checks: screen reader, real devices, browser matrix, text zoom, print and owner usability.

## Evidence template

```text
Task and test IDs:
Environment/browser/version:
Fixture/source versions:
Actions performed:
Expected outcome:
Observed outcome:
Status: passed | failed | not run
Evidence: screenshot/log/test result path, redacted
Limitations and required follow-up:
```

No test should be marked passed because its prose exists here. Release requires current application evidence for all applicable blockers.
