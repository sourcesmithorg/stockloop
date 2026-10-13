# Decision register

> **Superseded in part (2026-10-13):** D-01, D-02, and D-03 are now answered in `/README.md` (Lane B, stack selected, Postgres). All other decisions remain OPEN and must still be recorded before the work they block.

Date: 13 October 2026. Update this register when the owner makes a decision. Record source/date, accepted policy, affected features/tests and why it changed. Do not mark a proposal confirmed because an agent has written code for it.

## Confirmed direction

- StockLoop is an inventory purchasing copilot for neighborhood retailers, with a human-reviewed purchasing workflow.
- Cornerstore visual direction and friendly/practical/confident personality were selected for the delivered template.
- The delivered scope was static HTML/CSS only; the user's team owns slicing and all business logic.
- International country/currency choices, English/USD defaults, language/currency selection in onboarding, and regional settings are represented.
- The current request is a detailed Markdown guide pack in a ZIP. It does not authorize application setup, deployments or supplier messages.

## Open and proposed implementation decisions

| ID | Decision and recommended starting position | Status / owner | Blocks |
|---|---|---|---|
| D-01 | LaneA template-only versus LaneB application integration; exact repo/write scope | OPEN / product owner | All code tasks |
| D-02 | Frontend/router/build stack. Keep existing stack; none selected for new app | OPEN / engineering owner | Framework slicing/scaffold |
| D-03 | Backend/auth provider/environment. Convex preferred for new authorized backend; auth choice unresolved | PROPOSED preference + OPEN setup / engineering owner | Persistent store/auth work |
| D-04 | Roles, approval scope, partial approval and revocation. Proposed owner/operator/viewer split | OPEN / product/security owner | Trusted approval/export permissions |
| D-05 | CSV schemas, encoding, file limits, retained uploads and format selection | OPEN / product/engineering owner | Production import |
| D-06 | Sales reporting coverage, gaps, duplicate/overlap resolution, returns/voids | OPEN / product/data owner | Demand averages/import merge |
| D-07 | Stock snapshot replace versus movement/merge semantics | OPEN / product/data owner | Reliable stock persistence |
| D-08 | Atomic versus partial import and correction/retry policy. Prefer atomic MVP until explicit partial policy | PROPOSED / product owner | Import commit success semantics |
| D-09 | Freshness thresholds, supplier validity, calendar/business lead time, holidays/cutoffs | OPEN / product owner | Risk/delivery estimate eligibility |
| D-10 | Demand window, target/safety definition, risk thresholds and ordering cadence. Simple formula is a candidate | PROPOSED / product owner | Authoritative plan/risk calculation |
| D-11 | Pack/MOQ edits, minimum order value, warning acknowledgments, tax/shipping, document formats/legal terms | OPEN / product/commercial owner | Approval-ready totals/documents |
| D-12 | Supported translated locales, fallback, currency precision/budgets and any FX policy | OPEN / product/finance owner | Worldwide production promises/mixed currency |
| D-13 | AI provider/model, schema, retention, regional constraints, spend/timeouts and whether AI is in release | OPEN / product/engineering owner | Live advisory AI |
| D-14 | Whether optional customer-intent/alternatives/demand/email ideas are actually required | UNCONFIRMED / product owner | Extension implementation |
| D-15 | Release audience/target, deployment approval, data retention/backups/artifact access/observability | OPEN / product/operations owner | Operational release |

## What does not require another decision

Use established tokens, semantic labels, text statuses, visible keyboard focus, component-scoped table scrolling, coherent fixtures and honest demo boundaries. Preserve correct record identity and approval/export separation. Do not ask the owner whether missing stock should magically become zero.

## Missing additional brief

The available user message includes “here additional information” but no substantive additional text. The earlier assistant's mention of customer-intent, alternatives, demand capture and supplier email is not accepted source material. Documenting them as OPTIONAL preserves the idea without silently authorizing it. Ask for the intended additional brief before promoting D-14; core documentation and approved template work need not wait.

## Decision record template

```text
Decision ID:
Status: proposed | accepted | superseded
Owner and source/date:
Question:
Options considered:
Accepted policy:
Reason/tradeoff:
Affected features / contracts / tests / tasks:
Migration or compatibility impact:
External authorization needed:
```

## Escalation rules

An agent should name exactly what the decision changes. For example: “Without D-08, I can design validation states but cannot promise which rows commit.” Avoid blocking all UI work because one provider decision is open. Do not use a reasonable proposal as a hidden production default.
