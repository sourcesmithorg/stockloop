# StockLoop roadmap

> **Superseded in part (2026-10-13):** milestones/capability grouping still applies; lanes-as-framework-choice is obsolete. Stack is fixed in `/README.md`. Do not read this file as the current task scope — see /todo

Status: dependency-ordered implementation proposal. No dates, durations, staffing, framework or deployment target have been approved. The owner selects individual tasks; this file is not authorization to run every milestone.

## Delivery lanes

**Lane A, UI-only:** preserve static HTML/CSS; extend or slice approved screens using fixtures. Produce browser-verified UI without pretending persistence/business operations exist.

**Lane B, application integration:** only after explicit authorization. Replace fixtures with trusted data, deterministic calculations, real saves and audited approval/export. Keep the reference design intact.

Do not force a framework rewrite for Lane A. Do not retain fake-success links for Lane B.

## Dependency graph

M0 scope/baseline → M1 UI foundation → M2 store/auth/preferences → M3 trusted imports/catalog → M4 deterministic risk/plans → M5 advisory AI → M6 review/approval/documents → M7 release hardening.

M5 is optional for functional release: M4's rule-based explanation can support M6. M6 depends on M2 authorization and M3/M4 versioned inputs, not on AI availability. Supplier terms from M3 are required before affected lines can be approval-ready. Export and approval guards must exist before live release.

## M0: scope and baseline lock

Tasks: SL-01 and SL-02. Sources: all template docs and [BASELINE.md](BASELINE.md).

### Work

- Locate the actual application repository and record its stack/current changes.
- Preserve the static kit as the visual reference. Map template paths to planned routes.
- Confirm Lane A or Lane B, owner role, release audience and acceptance evidence.
- Resolve D-01–D-04 if starting application integration. Record remaining policy decisions, not invented defaults.
- Create a small reproducible fixture/test dataset based on the coherent USD example.

### Exit gate

Owner confirms task scope and write boundaries. Local agent can identify all 19 screens, all 40 states, authoritative design tokens and nonfunctional fixture actions. No new infrastructure is silently created.

## M1: UI foundation and slicing

Tasks: SL-03 and SL-04. Dependencies: M0. Tests: T-01–T-04, T-22–T-24.

### Work

- Extract app shell, headings, fields, buttons, pills, tables, disclosure, feedback and review rail.
- Preserve `data-state` examples in development/test tooling, not public operational routes.
- Establish route identity and keyboard navigation. Make selected nav state accurate.
- Keep fonts/assets local and preserve font license.
- Test widths 1440/768/390/320, long text, 200% text zoom, reduced motion and forced colors.

### Exit gate

Reference parity and no whole-page overflow. Labels, landmarks, table captions/headers and visible focus survive the port. No false-save/import/approval actions are shipped. New browser evidence replaces assumptions.

## M2: store identity, access and regional setup

Tasks: SL-05 and SL-06. Dependencies: M1 and D-02–D-04. Tests: T-05, T-06, T-20, T-22.

### Work

- Integrate chosen auth provider and store membership; isolate store data server-side.
- Implement registration/onboarding with country, language, currency and IANA timezone.
- Persist preferences with clear save/error/unsaved/conflict states.
- English/USD defaults remain editable. Changing display currency does not relabel historical documents.
- Provide genuine first-run readiness and a separate demo mode.

### Exit gate

Reload demonstrates saved preferences. Unauthorized access fails at trusted boundaries. Auth secrets never enter client code. A failed save retains user input. Locale support/fallback promises are honest.

## M3: trusted data and supplier/catalog readiness

Tasks: SL-07, SL-08 and SL-09. Dependencies: M2, D-05–D-09. Tests: T-07–T-10, T-21.

### Work

- Establish catalog identity, stock snapshots, sales reporting windows and supplier terms.
- Import lifecycle: file selection → mapping → validation → human confirmation → commit → verified result.
- Reject/flag duplicate keys, invalid values, unknown references and ambiguous locale formats.
- Implement import idempotency and data versions; commit only under the approved atomic/partial policy.
- Treat calendar/lead time/pack/MOQ/cost/currency completeness as approval prerequisites.

### Exit gate

Source filenames, periods, versions and row counts are traceable. Missing history is not zero sales. Failed imports produce no fake success or hidden partial commit. Valid imports generate new versions and trigger downstream revalidation.

## M4: deterministic inventory risk and restock plans

Tasks: SL-10 and SL-11. Dependencies: M3, D-09–D-12. Tests: T-11–T-15.

### Work

- Implement owner-approved demand-window, stock-cover, target, safety and rounding rules.
- Show observed values, estimates, calendar assumptions and unresolved delivery gaps separately.
- Group proposals by supplier/currency; enforce packs, MOQ and budget policy.
- Build explainable rule-based proposals before AI integration.
- Recalculate editable quantities and create plan versions. Provide explicit unknown/blocked states.

### Exit gate

Fixture arithmetic is reproducible; zero/missing histories cannot create infinity/NaN or misleading healthy status. Negative, fractional or off-pack quantities follow approved policy. Budget totals are not cross-currency sums. Increasing quantity never claims to solve delivery availability.

## M5: advisory AI explanations

Task: SL-12. Dependencies: M4, D-13. Tests: T-16 and T-17.

### Work

- Integrate the selected provider behind a server adapter. Gemini is a candidate, not a fixed model/version.
- Restrict input to authorized snapshot data; require structured output and version references.
- Validate output against known SKUs, quantities, prices, currency and deterministic constraints.
- Render explanation source and uncertainty without fake confidence percentages.
- Handle loading, refusal, quota, timeout, malformed output, stale response and rule-based fallback.

### Exit gate

No provider failure blocks the deterministic review workflow. Model output cannot approve/export, change verified costs, execute links or request secrets. Invalid suggestions are rejected visibly.

## M6: human review, approval and supplier documents

Tasks: SL-13, SL-14 and SL-15. Dependencies: M2/M3/M4. M5 optional. Tests: T-18–T-21, T-25.

### Work

- Review actual quantities, totals, excluded lines and unresolved warnings.
- Define immutable approval versions and permissions. Enforce reapproval after relevant edits/imports.
- Generate one PO per supplier/currency. Bind row identity correctly; preserve historical facts.
- Export only the approved current version. Capture attempt/result states without implying placement.
- Keep print/PDF output readable, include approved version/provenance and tax/shipping treatment.

### Exit gate

Concurrent edits cannot create stale exports. Duplicate clicks/retries cannot create unintended duplicates. Failed exports preserve the document. “Downloaded/export ready” is never “supplier accepted.” Supplier email remains out of core scope.

## M7: release hardening and pilot

Tasks: SL-16 and SL-17. Dependencies: M1–M4/M6. M5 only if in release scope. Tests: all applicable tests.

### Work

- Run end-to-end journeys with realistic bad imports, expired sessions, offline states and conflicts.
- Review accessibility manually with keyboard/screen reader and current target browsers/devices.
- Test timezone/DST, currency precision, RTL, language fallback and text expansion.
- Complete security, provider timeout/retry, operational observability and data-retention decisions.
- Conduct an owner-observed retailer usability pilot; record findings without invented metrics.
- Obtain explicit release/deployment approval and confirm rollback/backup procedures.

### Exit gate

No unresolved blocking acceptance criteria. Known limitations are documented. Release authority, environment and secrets are established. Tests refer to the implemented application, not the old static-kit report.

## Optional extension gate

Customer-intent capture, alternative products, unmet-demand analytics and supplier email are **not confirmed requirements**. They must not delay the core purchasing loop or appear as completed roadmap work. Use [OPTIONAL-EXTENSIONS.md](OPTIONAL-EXTENSIONS.md) for discovery only; promote one through D-14 after owner approval and a separate shape brief.

## Milestone report template

For each milestone record: tasks accepted, tests passed/failed/not run, browser evidence, open policy decisions, source versions, remaining risks and next authorized task. A milestone is complete only when its exit gate is evidenced; a running server, merged code or attractive screenshot alone is insufficient.
