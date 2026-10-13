# StockLoop feature specifications

Future application behavior is PROPOSED unless explicitly marked CONFIRMED. The existing HTML screens are fixtures. Each feature below can be implemented only in an owner-authorized task. Feature IDs map to the roadmap/backlog and acceptance tests.

## F-01: account, store and regional onboarding

**User goal:** establish an accessible store context with correct regional preferences. Templates: `login.html`, `register.html`, `onboarding.html`, `welcome.html`, `settings.html`.

**Confirmed UI:** English/USD defaults, independent country/language/currency/timezone controls, first-run no-data composition.

**Proposed behavior:** authenticate, create/select a store, validate membership, save store identity and preferences, then show actual dataset readiness. Registration should not imply completion until identity creation and store membership succeed. Keep demo separate from operational store data.

**Fields:** store name, country ISO code, language/locale tag, currency ISO code, IANA timezone; auth fields depend on approved provider. Do not assume all 35 template languages are fully translated. Explain fallback.

**States:** auth pending/error/reset, invalid fields, unavailable locale, unsaved changes, saving/error/success, duplicate submission, expired session and permission failure.

**Done:** preferences persist after reload; country changes do not silently alter currency; historical documents retain currency; unauthorized store reads/mutations fail server-side. Tests T-05/T-06/T-20/T-22. Open D-02–D-04, D-12.

## F-02: dataset import and readiness

**User goal:** understand whether sales, inventory and supplier terms can support a trustworthy proposal. Templates: four import steps plus `welcome.html`.

**Flow:** select dataset/file → inspect mapping/format → validate → review counts and policy → commit → verify result/version. Selecting a file is not importing. Never show success before persistence.

**Required UI data:** dataset, original filename, file size, source digest/job ID, reporting period/timezone, row counts, mappings, errors/warnings, affected records, commit policy, snapshot/version and timestamp. Define file limits and accepted encoding in D-05.

**Validation:** required fields, duplicates/conflicting keys, negative/nonfinite quantities, invalid dates, locale-dependent decimal ambiguity, missing supplier/SKU references, unknown currency/units, stale reports and overlapping sales ranges. Unknown stock/history stays unknown.

**Failure/recovery:** block mapping continuation until resolved. Preserve preview on validation failure. A retry must not double-apply sales or stock. If partial import is approved, explicitly show accepted/rejected rows; otherwise an error causes no commit. Corrections must create a new validation result, not erase the old issues by UI toggle.

**Done:** counts reconcile and import provenance is auditable; commit is idempotent; new committed data invalidates affected plans. Tests T-07–T-10/T-21. Open D-05–D-08.

## F-03: inventory overview and product risk

**User goal:** find a specific SKU, see what is known and understand replenishment timing. Templates: `index.html`, `inventory.html`, `product.html`.

**List:** SKU/name, base unit, stock snapshot, average demand/reporting window, cover estimate, supplier lead-time/calendar assumptions and state. Search/filter/pagination must be genuine in an application. Counts are scoped to query/proposal/store explicitly.

**Product detail:** observed inputs first; derived cover/depletion estimate second; supplier readiness/calendar third; reasoning and historic chart last. A SKU chart must use that SKU, matching reporting window and average. Chart data has an accessible summary/table alternative in a real app.

**Risk branches:** actual zero stock, positive cover less than delivery horizon, low stock under approved target, healthy, verified zero sales, missing history/stock/terms, stale snapshot. Priority ordering and low-stock threshold require D-09/D-10.

**Delivery:** calendar-day math is not a confirmed shipment date. Cutoffs/weekends/holidays/timezone may extend timing. Show unresolved gaps; buying extra does not erase a delivery gap.

**Done:** route identity correct, no infinity/NaN/negative cover, zero/missing distinct, provenance visible and no misleading healthy status for blocked data. Tests T-01/T-11/T-12/T-23. Open D-09/D-10.

## F-04: suppliers and commercial terms

**User goal:** know which terms are reliable before proposing a purchase. Templates: `suppliers.html`, `supplier.html`, supplier form state.

**Supplier fields:** stable identity, name, contact, document currency, store-local delivery windows/cutoff, calendar policy, last verified time. Product-supplier terms include unit cost, purchase pack, MOQ, lead time and price unit. Product overrides must be visible.

**Interactions:** edit with validation/dirty/save/conflict states. Completeness reports specific missing terms. Changing price, pack, currency, lead time or delivery availability produces a new terms version and affects existing approvals.

**States:** missing contact is not necessarily a core calculation blocker; missing cost/pack/lead time/currency may block affected lines. Blocking policy belongs to D-09/D-11. Do not silently set missing cost to zero.

**Done:** quantities and price units are unambiguous, invalid terms rejected, changes versioned, correct supplier details/routes, applicable plans revalidated. Tests T-10/T-13/T-20/T-21.

## F-05: deterministic plan generation and editing

**User goal:** review quantities that respect packs, MOQ, supplier grouping and budget. Template: `reorder.html`.

**Inputs:** source snapshot versions, demand window, target/safety/lead-time policy, eligible products, supplier terms, per-currency budgets. Default calculation policy is a proposal in [CALCULATION-RULES.md](CALCULATION-RULES.md), not approved finance logic.

**Output:** line suggestion, original units, editable units, packs, costs, currency, constraints/blockers/warnings, included/excluded state and rule explanation. Summaries distinguish all suggestions from eligible selections.

**Editing:** validate values, recalculate and produce a new plan version. Pending/error computation cannot remain approval-ready. Existing approval invalidates on relevant changes. Zero quantity means deliberate exclusion only under approved policy, not an accidental MOQ workaround.

**Budget shortage:** show total, available budget, shortfall and remaining risk. No silent optimization or quantity removal. Multi-currency groups cannot consume a single scalar USD budget without D-12.

**Done:** reproducible arithmetic, safe precision, visible unknowns, pack/MOQ checks, budget explanation and versioned edits. Tests T-13–T-15/T-19/T-21. Open D-09–D-12.

## F-06: AI-assisted explanation

**User goal:** understand an already validated proposal, not delegate purchasing authority. Sources: reorder explanations and AI states.

**Provider:** OPEN. Gemini may be selected later; no API/version/key is configured. Use a server adapter with timeouts, allowlisted data, redaction, structured response and version correlation.

**Output:** concise explanation per known line, relevant assumptions/risks and optional candidate quantities. Trusted code verifies all referenced facts and constraints. Reject unknown SKUs, invalid values, stale versions, unauthorized calls and assertions that contradict source data. Unsupported AI prose must not be presented as verified operational fact.

**States:** waiting, previous stale explanation, quota/timeouts/refusal, malformed output, invalid candidates and transparent rule-based fallback.

**Done:** no AI response can approve/export or modify authoritative prices; fallbacks remain usable and honestly labeled. Tests T-16/T-17. See [AI-CONTRACT.md](AI-CONTRACT.md), D-13.

## F-07: approval and supplier document preview

**User goal:** explicitly authorize exact reviewed items and understand what remains unresolved. Templates: reorder, order list/document and approval states.

**Review:** show selected/excluded lines, supplier/currency subtotals, pack quantities, budget, tax/shipping treatment, delivery warnings, source versions and approval actor scope. Blocking constraints prevent approval. Nonblocking warnings require a defined acknowledgment policy.

**Version boundary:** approval stores an immutable content/version reference and actor/time. Trusted service checks permissions, current inputs and constraints. Concurrent input change rejects stale approval. Partial approval is permitted only after D-04/D-11 define its scope.

**Document:** one supplier/currency, exact approved quantities/terms/version, distinct draft/approved/stale states. A route must open that order, not the reference PO fixture. The static print example is not a legally valid document by itself.

**Done:** content edits invalidate approval, viewers cannot approve, rejected stale attempts show useful recovery, historical approved snapshots remain auditable. Tests T-18/T-19/T-20/T-21/T-25.

## F-08: document export and order history

**User goal:** obtain the reviewed supplier-specific file and know whether that operation succeeded. Templates: `orders.html`, `order.html`, export states.

**Eligibility:** approved version is current, all blocking checks clear, actor authorized, supplier/currency/line identity correct. Revalidate at export boundary, not only in UI.

**Lifecycle:** eligible → exporting → exported/failed/unknown. If an asynchronous request is ambiguous, reconcile the attempt/result before retrying. Preserve the document and approval on export failure; do not automatically produce a new approval.

**Copy:** “Export ready” for generated artifact; “Downloaded” only when the application can support that claim. Export is not supplier transmission, acceptance or order placement. File names should identify supplier, order, version and date without leaking unnecessary private data.

**Done:** export content matches approved values, recoverable failure does not lose data, repeated attempts are traceable/idempotent as required, print readable, history states truthful. Tests T-18/T-19/T-21/T-25. Format/legal/commercial requirements OPEN, D-11.

## Feature change procedure

A change in policy updates feature text, data contract, calculation/state logic, backlog dependencies and acceptance tests together. New screens/flows need a task-specific design brief. User-supplied new requirements should be quoted/sourced in [DECISIONS.md](DECISIONS.md); do not infer them from an earlier assistant progress message.
