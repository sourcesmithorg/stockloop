# Implementation and slicing guide

> **Superseded in part (2026-10-13):** frontend (React+TS+Vite), backend (FastAPI), and database (Postgres) are decided — see `/README.md`. The separation-of-concerns and security sections still apply; ignore the Convex paragraphs.

Status: planning guidance for a future authorized build. The current task creates Markdown only. No app code, stack or environment is changed.

## Start without destroying the reference

Extract the HTML kit separately. Identify the actual repository/branch/instructions. Retain the delivered HTML/CSS as a baseline, preferably in a read-only reference directory. Do not turn its authored fixture-success links into live operations accidentally.

If the owner wants template refinements only, edit semantic HTML/shared CSS and keep all logic outside scope. If the owner authorizes an application, record framework, routing, storage/auth/provider choices before scaffolding. Keep an existing stack; do not migrate for aesthetic preference.

Convex is the preference when a new backend is needed and explicitly authorized. It is not provisioned here. No Next.js/React/Vue/Svelte stack is selected. Repository structure below is a conceptual example, not a mandatory scaffold or set of existing folders.

## Proposed separation of concerns

```text
reference/             preserved static kit
ui/                    shell, primitives, screens and development state gallery
application/           use cases, query/view models, orchestration
domain/               deterministic calculations and constraint policies
infrastructure/       storage, auth, AI/export adapters
tests/                unit, integration, browser and fixtures
docs/                 accepted requirements, decisions, architecture and QA
```

Use the target project's normal naming/layout, not literal copy-paste of this tree. Deterministic rule code should be reusable by tests and trusted service logic. Presentation should not recompute authoritative finance/approval state independently.

## Component extraction order

1. App shell/navigation/skip link and page heading.
2. Button/link variants, fields, quantity input, help/error text and status pills.
3. Product identity, table scroll region, captions/headers and disclosure.
4. Feedback, loading/empty states and dataset stepper.
5. Apricot review rail, constraint checklist and supplier document.

Extract only genuine reuse. Do not introduce an abstraction for every panel. Preserve original tokens and semantic boundaries. In a framework port, inline icons or sprite strategy must remain accessible; don't create broken external `<use>` references.

## Route migration

Use stable IDs. A product route resolves that product, not a universal oat-milk screen. Missing/deleted records need a meaningful not-found/archived state. Preserve history snapshots when current catalog/supplier records change. Auth redirects must not lose intended route or expose other stores.

Development galleries should be excluded from production navigation unless explicitly intended for documentation. Remove fixture actions from operational code or guard them behind unmistakable demo mode. Do not deploy a development-only success anchor as a production approval button.

## Forms and saves

Keep controlled state, validation status, dirty/saving/error/conflict flags distinct. Submit only validated data. Disabling the submit button is UX, not security. Trusted service checks auth, data types, permissions and expectedVersion again.

Use genuine success after persistence; verify reload. Keep edits when a recoverable request fails. Avoid storing secrets in local state/storage. If offline caching is proposed, scope/retention/encryption and synchronization policy require a separate decision; the gallery's offline sample does not authorize an offline-first subsystem.

## Import integration

Read [DATA-CONTRACTS.md](DATA-CONTRACTS.md) before implementing parsers. The CSV samples are tiny fictional examples, not exhaustive schemas. Decide accepted columns/encoding/limits, row identity, reporting coverage and commit policy. Preview/mapping/validation should use one versioned import job, not independent inconsistent client/server parsers.

Consider spreadsheet-formula injection in generated CSV downloads, escaped HTML in previews and resource limits for large uploads. Do not parse arbitrary executable content. Corrected files/maps get new validation results. Import retries must reconcile committed jobs before applying again.

## Rule/AI integration

Build deterministic risk/proposal logic first. Policy changes are versioned. Keep observed inputs, estimates, assumptions and model prose distinct. AI receives authorized minimized data behind a trusted provider adapter and cannot call approve/export/send. See [CALCULATION-RULES.md](CALCULATION-RULES.md) and [AI-CONTRACT.md](AI-CONTRACT.md).

## Approval/export boundary

Approval records exact content, scope and versions. Revalidate on trusted service before export. New quantity/terms/source data invalidate applicable approvals. Preserve the historic document while requiring a new reviewed version for changed content.

External artifact generation should have attempt IDs and reconciliation states. A timeout is ambiguous until checked. Do not assume each retry should create a new order. Supplier transmission remains optional/unconfirmed and is separate from document export.

## Security and privacy minimums

- Store-scoped authorization on every operational query/mutation/artifact.
- Validate identifiers/units/currencies/versions server-side.
- Escape raw supplier/CSV/AI text. No executable model instructions.
- Secrets only in protected server configuration; never screenshots/docs/client code.
- Restrict artifact access, uploads, file size/type and unsafe downloads.
- Log safe event metadata, not raw sensitive datasets or credentials.
- Define retention, deletion, audit and backup policy before operational release.

## Recommended first vertical slice

After owner authorization, implement one store-scoped inventory query and product detail using a coherent fixture/dataset. Reproduce the reference, preserve unknown/zero/stale branches, route identity and provenance. Verify responsive/keyboard behavior. Then import one validated dataset and prove persistence. Do not start simultaneously with auth, full AI, all imports and all exports.

## Definition of integration done

Real data/persistence where required, trusted guards, current tests, all task states and browser evidence. Update accepted decisions/contracts and remove only fixtures replaced by real behavior. Preserve demo boundaries. No release until D-15 and explicit deployment authority are settled.
