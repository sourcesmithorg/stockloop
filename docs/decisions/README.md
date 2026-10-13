# Decision records

StockLoop has open business-policy questions. A decision is recorded **here** before the
behaviour it blocks is implemented. `.docs/DECISIONS.md` is the register of record for the
original proposal list; this directory holds the owner's actual accepted answers.

> An agent proposing a policy is not an owner accepting one. Do not mark a proposal as
> accepted because code implementing it exists.

## Open decisions

The delivered register proposed D-01 through D-15. Current status:

- **D-01 — answered.** Lane B (application integration), not template-only.
- **D-02 — answered.** Frontend: React + TypeScript + Vite.
- **D-03 — answered.** Backend: FastAPI with PostgreSQL; deployment on Cloud Run.

These three are recorded in `/README.md` and `/AGENTS.md`. They are settled — do not reopen
them without the owner reversing the stack decision.

**D-04 through D-15 remain OPEN.** Notable ones and what they block:

| ID | Question | Blocks |
|---|---|---|
| D-04 | Roles, approval scope, partial approval, revocation | Trusted approval and export permissions |
| D-05 | CSV schemas, encoding, file limits, format selection | Production import |
| D-06 | Sales reporting coverage, gaps, duplicate/overlap resolution, returns | Demand averages and import merge |
| D-07 | Stock snapshot replace versus movement/merge semantics | Reliable stock persistence |
| D-08 | Atomic versus partial import, correction and retry policy | Import commit success semantics |
| D-09 | Freshness thresholds, supplier validity, calendar versus business lead time | Risk and delivery-estimate eligibility |
| D-10 | Demand window, target/safety definition, risk thresholds, ordering cadence | Authoritative plan and risk calculation |
| D-11 | Pack/MOQ edits, minimum order value, warnings, tax/shipping, document formats | Approval-ready totals and documents |
| D-12 | Supported translated locales, fallback, currency precision, FX policy | Worldwide production promises |
| D-13 | AI provider/model, schema, retention, spend, timeouts, release inclusion | Live advisory AI |
| D-14 | Whether customer-intent/alternatives/demand/email ideas are required | Extension implementation |
| D-15 | Release audience, deployment approval, retention, backups, observability | Operational release |

## Template

Copy this into a new file named `D-NN-short-slug.md` in this directory:

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

Resolve only the decisions that block the task in front of you. Do not block all UI work
because one provider decision is still open.
