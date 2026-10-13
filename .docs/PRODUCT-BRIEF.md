# StockLoop product brief

Status: confirmed product direction plus explicitly labeled implementation proposals. This document plans future application work; it does not claim any of that logic exists.

## Problem and users

Small neighborhood retailers need to turn imperfect stock, sales and supplier information into an understandable purchasing decision. The owner often works at a bright shop counter between customers, using a laptop or phone. They need to know what needs replenishment, why, what it costs, what remains risky, and what they are approving.

The second audience is the frontend/backend team and its local AI agents. The static template gives them component-friendly UI and realistic edge states, while leaving implementation to them.

## Product outcome

**Core workflow:** prepare datasets → inspect inventory risk → review an explainable, constraint-checked proposal → edit quantities → human approval → supplier-specific document preview/export.

The product succeeds when the owner can trace an order back to inputs, constraints and an approved version. It fails if a polished dashboard hides missing information or implies a purchase has happened when only a file was generated.

## Confirmed baseline

- Brand: friendly, practical, confident. Visual direction: Cornerstore.
- Deliverable already created: 19 responsive static HTML pages with shared CSS, local assets, 40 state fixtures and sample CSVs.
- No runtime JavaScript, backend, real authentication, CSV processing, purchasing calculations, AI calls, persistence, translation, conversion or application export in that deliverable.
- International country/currency support is requested, with English/USD defaults and language/currency selection during onboarding/registration. Country and timezone context are also represented in the delivered UI.
- The current request authorizes detailed Markdown guidance in a ZIP, not a code build or deployment.

## Core functional scope for an authorized future build

1. Store setup and independent regional preferences.
2. Dataset readiness, import mapping, validation and source provenance.
3. Inventory list and product-specific risk explanation.
4. Supplier identity, pricing, lead time, pack size, MOQ and delivery windows.
5. Deterministic purchase-policy calculation and visible constraints.
6. Optional advisory AI explanation with deterministic fallback.
7. Editable proposals with versioning and approval invalidation.
8. Human approval and one document per supplier/currency.
9. Export eligibility, recoverable failure and truthful completion status.
10. Accessible, responsive UI with explicit empty/loading/stale/failure states.

This is a scope outline for the roadmap. The owner must still select the implementation slice, stack, business policies and release audience.

## Non-goals

Do not build billing, supplier marketplaces, customer loyalty, team-management suites, POS hardware integrations, forecasting research, autonomous purchasing, chat-first navigation or warehouse ERP features as part of this core. Supplier email, customer-intent capture, alternatives and demand aggregation are unconfirmed extensions, not prerequisites for the established loop.

## Success criteria and measurements

Suggested metrics require instrumentation and owner-approved targets; no baseline numbers are invented here.

| Measure | Definition | Guardrail |
|---|---|---|
| Time to first trustworthy plan | From completed minimum datasets to a validated proposal | Exclude demo fixtures and missing-input plans |
| Review completion | Owners who reach a reviewed supplier document | An export is not a purchase conversion |
| Data correction burden | Rejected rows and correction attempts per import | Track causes without raw sensitive CSV values |
| Constraint visibility | Owners can identify costs, delivery gaps and blockers | Usability observation, not a fabricated AI score |
| Approval integrity | Exports tied to current approved versions | Target: no stale/unapproved export by design |
| Recovery reliability | Failed operations retain data and can be retried safely | No duplicate imports, approvals or exports |

## Product principles

- Lead with the next decision, not a wall of analytics.
- Separate observed inputs, derived estimates, policy assumptions and AI explanations.
- Prefer an honest unknown to a plausible invented value.
- Preserve owner control and explain disabled actions.
- Respect country/language/currency differences without silently converting money.
- Keep complexity progressive: quick scan first, reasoning and details on demand.

## User journeys

**First run:** select region → learn which datasets are required → import or open a clearly separate demo → correct issues → see the first data-backed inventory view.

**Daily purchasing:** inspect freshness → scan stockout/low-stock risks → inspect a SKU's inputs → generate/review a plan → adjust quantities → review unresolved constraints → approve eligible supplier groups → export the reviewed document.

**Recovery:** missing supplier cost blocks the affected line → owner completes terms → recalculation creates a new plan version → owner reapproves → export uses that exact version.

## Roles, proposed minimum

Owner can set purchasing policy and approve/export. Operator can import and review but cannot approve unless the owner grants that permission. Read-only viewer can inspect. This is a proposed policy, not implemented authorization. See [DECISIONS.md](DECISIONS.md), D-04, before adopting it.

## Requirement provenance

[BASELINE.md](BASELINE.md) and `references/TEMPLATE-BRIEF.md` describe the delivered work. This document's implementation contracts are planning guidance. When new user information arrives, record its source/date in [DECISIONS.md](DECISIONS.md), then update affected feature, backlog and test IDs together. Do not quietly promote assistant suggestions to confirmed requirements.
