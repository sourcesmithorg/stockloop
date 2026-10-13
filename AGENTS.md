# StockLoop — agent instructions

Canonical entry point for coding agents. The delivered guidance in .docs/ is reference material; where the two disagree, this file wins.

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript + Vite | Inventory dashboard, customer chat, charts |
| UI | Tailwind CSS + shadcn/ui | Fast, consistent interface development |
| Backend | Python + FastAPI | REST API, inventory rules, AI orchestration |
| Database | PostgreSQL | Products, sales, stock, suppliers, purchase orders |
| AI | Gemini on Vertex AI | Understand customer requests, explain recommendations, generate purchase-order drafts |
| Forecasting | Python + pandas | Calculate demand and reorder quantities |
| Deployment | Google Cloud Run | Host the frontend and backend |
| Analytics | BigQuery, optional | Analyze larger transaction datasets and build advanced forecasting |

This table supersedes .docs/AGENTS.md "Development architecture guidance" and .docs/IMPLEMENTATION-GUIDE.md "Start without destroying the reference".

## Repository layout

```text
stockloop/
├── .docs/              # delivered implementation guidance (read-only)
├── .template/          # delivered static HTML reference (read-only)
├── docs/               # project-owned docs; decisions/ holds decision records
├── api/                # FastAPI backend            (empty, README stub)
├── web/                # React + Vite frontend      (empty, README stub)
├── .env.example        # documented configuration surface
├── .gitattributes      # LF normalization; binary markers
├── .gitignore
├── AGENTS.md           # canonical agent entry point
├── README.md           # human onboarding
├── Makefile            # template / db-up / db-down / db-logs / env
├── compose.yaml        # Postgres 16 on host :5433
└── todo                # live ordered task queue
```

## Product invariants

Source: .docs/AGENTS.md. These are not negotiable and do not depend on stack choice.

- An owner reviews and approves a purchase proposal. StockLoop does not autonomously buy stock.
- Deterministic validation is authoritative. AI explains and may propose candidates. Only trusted rule code determines eligibility; model output remains advisory.
- Unknown stock, cost, supplier or sales history is not zero. Verified zero sales is a separate state.
- A delivery gap remains even after ordering more. Calendar-day estimates are not confirmed supplier delivery slots.
- Quantities distinguish base units from purchase packs. Prices, totals and budgets retain currency and precision.
- Never combine currencies into a single budget total without an approved conversion policy.
- Approval binds an immutable plan/version. Relevant edits or updated inputs require revalidation and reapproval.
- Export success is not email sent, supplier acceptance, purchase placed or delivery completed.
- Do not present placeholders as measured data. Demo mode is explicit and isolated from real operational data.
- English and USD are defaults, not compulsory locale/currency. Country, language, currency and timezone remain independent choices.

## Visual invariants

Preserve Cornerstore: warm mineral paper, charcoal typography, terracotta actions, a quiet task sidebar, readable operational tables, apricot review rail, and a supplier-document layout distinct from the dashboard. Reuse the canonical tokens in [DESIGN.md](DESIGN.md) and existing CSS. No cold enterprise restyling, chatbot-first workflow, glass dashboard, purple/neon AI theater, gradient text, decorative metric heroes or nested identical card grids.

Controls have labels, focus indicators and readable disabled reasons. Status needs text, not color alone. Native disclosures must work on keyboard/touch. Tables scroll inside labeled components; the page must not widen to fit them. Preserve reduced-motion and forced-colors behavior. New UI must support loading, empty, failure, stale and success states, not just the happy path.

Tailwind must be configured from .docs/DESIGN.md tokens (see /README.md "Design tokens") — not from shadcn/ui defaults.

## Working boundaries

- No production deployment, commits/pushes, live provider provisioning, supplier email, payment or purchasing without explicit owner authority for that action.
- An authorization to design an email screen is not authorization to send an email.
- Use test providers/sandbox recipients when integration is authorized; label them unmistakably.
- Inspect configuration before edits and preserve unrelated settings.
- Never fabricate secrets, service IDs, credentials, model availability, endpoints or successful provider receipts.
- This repo has a git remote. Never run git commit, git push, or open a PR without explicit owner authorization for that action.

## Execution protocol

1. **Inspect.** Locate the source screen and current behavior. Confirm whether it is a fixture or implemented route, record existing tests, assets and framework, and verify the current task's scope and write paths; do not install tooling just to discover it.
2. **State a bounded plan.** Name the objective, source templates, changes allowed, decisions needed, expected evidence and rollback boundary, and list two or three verifiable steps. If policy is unresolved, use an explicit labeled fixture/proposal for design work and block only the affected real behavior.
3. **Design before significant UI changes.** For a new flow or major redesign, produce a brief showing user goal, primary action, navigation, data hierarchy, state coverage and mobile composition, and obtain owner confirmation before building it. Do not invent visual direction silently.
4. **Implement surgically.** Change only task-owned paths; reuse components/tokens and avoid adjacent refactors and speculative infrastructure. For UI slicing, reproduce the reference first before redesigning, and add regression tests for the affected invariant.
5. **Verify.** Run available relevant tests. For UI, open the changed screens in a real browser at 1440/768/390/320 px, inspect desktop and narrow mobile, use keyboard navigation, test empty/loading/error/stale states, and capture evidence. For persistence, reload and confirm the saved result; a failed save retains edits and shows a recoverable error; never report an automated accessibility pass as WCAG certification.
6. **Report.** State changed paths, verified results, unverified areas and blockers. A build that ran is not a feature that works. Do not mark a task complete with required decisions or failing tests outstanding.

## Commands

| Command | Purpose |
|---|---|
| `make template` | Serve the read-only UI reference on http://localhost:4173 |
| `make env` | Copy `.env.example` to `.env` if absent |
| `make db-up` | Start local Postgres 16 on host port 5433 |
| `make db-down` | Stop the Postgres container |
| `make db-logs` | Follow Postgres logs |

These are the only targets that exist. Frontend and backend dev targets are added by the scaffold tasks in /todo.
