# StockLoop

StockLoop is an inventory purchasing copilot for neighbourhood retailers. It turns stock and sales data into reviewable restock proposals that a human owner approves. Built for the AI Builder Cup. It is not autonomous purchasing — a person always approves before anything is ordered. The end state this repo targets is a deployable React + FastAPI application on Cloud Run backed by Postgres.

## Status

The application is implemented and runs locally: React SPA (`web/`), FastAPI + Alembic API (`api/`), Postgres 16 — all wired through `docker compose up`.

Works today:

- `make up` builds and starts the whole stack: database, migrations, fixture seed, API, web UI.
- API: FastAPI, async SQLAlchemy, Alembic, 8 routers, idempotent fixture seed (`python -m app.seed`), tests in `api/tests`.
- Web: React 18 + TypeScript + Vite SPA with the full route tree; outside Docker it defaults to bundled fixtures (`VITE_USE_MOCK=true`), while the containerized build talks to the real API through the nginx `/api` proxy.
- AI endpoints are advisory Gemini calls with a deterministic rule-based fallback — empty AI variables mean no credentials are required.
- `make template` previews the 19 static reference screens; `make db-up` starts only Postgres.

Not implemented yet:

- Auth (M2): no login, no per-user authorization.
- Approval/export: plan approval exists; purchase-order export is partial.
- Deployment config: no Cloud Run wiring; local Compose only.

## Agreed stack

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

## Repository layout

```text
stockloop/
├── .docs/              # delivered implementation guidance (read-only)
├── .template/          # delivered static HTML reference (read-only)
├── docs/               # project-owned docs; decisions/ holds decision records
├── api/                # FastAPI backend (uv, Alembic, Dockerfile)
├── web/                # React + Vite frontend (pnpm, nginx Dockerfile)
├── .env.example        # documented configuration surface
├── .gitattributes      # LF normalization; binary markers
├── .gitignore
├── AGENTS.md           # canonical agent entry point
├── README.md           # human onboarding
├── Makefile            # up / down / logs / seed / shell-api / template / db-* / env
├── compose.yaml        # Postgres :5433, API host :8000->:8080, web :5173, one-shot migrate+seed
└── todo                # live ordered task queue
```

## Prerequisites

- Node ≥ 20 with pnpm 11 (authoring machine verified: Node v24.20.0, pnpm 11.20.0).
- Python 3.12 managed by uv (verified: uv 0.11.6).
- Docker with Compose v2+ (verified: Compose v5.1.1).
- GNU make.

Local Postgres deliberately runs on host port **5433**, not 5432, so it cannot collide with a developer's existing Postgres.

## Getting started

```bash
git clone git@github.com:sourcesmithorg/stockloop.git
cd stockloop
cp .env.example .env

make template   # preview the static UI reference at http://localhost:4173
make up         # build + start Postgres, migrate + seed, API, web
```

Ports after `make up`:

| URL | Service |
|---|---|
| http://localhost:5173 | Web UI (nginx; `/api` proxied to the API) |
| http://localhost:8000/api/health | API health — `db.reachable: true` when Postgres is up (host 8000 → container 8080) |
| localhost:5433 | Postgres on the host (5432 inside the compose network) |

Notes:

- Migrations and the fixture seed run automatically on every start via the one-shot `migrate` service (`alembic upgrade head && python -m app.seed` — both idempotent). Re-run any time with `make seed`.
- Reset the database: `docker compose down -v` (drops the `pgdata` volume), then `make up` — the next start ends seeded and usable again.
- Logs: `make logs` (all services) or `make db-logs`; shell inside the API container: `make shell-api`.
- AI defaults to rule-based with no credentials: `.env.example` ships `GEMINI_API_KEY` empty, and no secret is baked into any image or `compose.yaml`. Fill the AI variables only if you want the advisory Gemini endpoints.
- The database-only workflow is unchanged: `make db-up` / `make db-down` / `make db-logs`. The API host port (8000 → container 8080) and web host port (5173 → container 8080) are fixed in `compose.yaml`.

See "Status" above for what is and is not implemented yet.

## Design tokens

The Cornerstore design system is defined once, as CSS custom properties in `.template/assets/styles.css`. Every token below comes from that file's `:root` block.

**Colors**

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `oklch(97.5% .006 70)` | App background, warm mineral paper |
| `--color-surface` | `oklch(99.5% .003 70)` | Cards and panels |
| `--color-sidebar` | `oklch(96% .009 70)` | Task sidebar background |
| `--color-soft` | `oklch(95.4% .006 70)` | Subtle fills and strips |
| `--color-ink` | `oklch(25% .009 60)` | Primary text, charcoal |
| `--color-muted` | `oklch(49% .011 60)` | Secondary and helper text |
| `--color-border` | `oklch(88% .012 70)` | Borders and dividers |
| `--color-control` | `oklch(64% .015 70)` | Control outlines and chrome |
| `--color-primary` | `oklch(51% .153 37)` | Primary actions, terracotta |
| `--color-primary-hover` | `oklch(45% .145 37)` | Primary action hover state |
| `--color-primary-soft` | `oklch(95% .028 52)` | Tinted primary backgrounds |
| `--color-apricot` | `oklch(94% .035 61)` | Apricot review rail and accents |
| `--color-success` | `oklch(41% .07 156)` | Success status text |
| `--color-success-bg` | `oklch(94.5% .025 150)` | Success status background |
| `--color-warning` | `oklch(42% .089 70)` | Warning status text |
| `--color-warning-bg` | `oklch(96% .044 87)` | Warning status background |
| `--color-danger` | `oklch(44% .135 27)` | Danger status text |
| `--color-danger-bg` | `oklch(96% .022 25)` | Danger status background |
| `--color-info` | `oklch(42% .06 235)` | Info status text |
| `--color-info-bg` | `oklch(95% .018 235)` | Info status background |

**Typography**

| Token | Value | Use |
|---|---|---|
| `--font-ui` | `'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif` | UI typeface stack, DM Sans first |
| `--font-mono` | `ui-monospace,SFMono-Regular,Consolas,monospace` | Monospace stack for codes and figures |
| `--text-xs` | `.75rem` | Smallest label text |
| `--text-sm` | `.8125rem` | Secondary and small text |
| `--text-body` | `.9375rem` | Default body size |
| `--text-title` | `1.25rem` | Section and card titles |
| `--text-headline` | `2rem` | Page headlines |

**Radii**

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | Small radii, chips and inputs |
| `--radius-md` | `10px` | Medium radii, buttons |
| `--radius-lg` | `16px` | Large radii, cards and panels |

**Spacing**

| Token | Value | Use |
|---|---|---|
| `--space-xs` | `4px` | Tightest spacing step |
| `--space-sm` | `8px` | Compact spacing step |
| `--space-md` | `16px` | Default spacing step |
| `--space-lg` | `24px` | Section spacing step |
| `--space-xl` | `32px` | Wide spacing step |
| `--space-2xl` | `48px` | Widest spacing step |

**Other**

| Token | Value | Use |
|---|---|---|
| `--sidebar-width` | `224px` | Fixed task sidebar width |
| `--ease` | `cubic-bezier(.16,1,.3,1)` | Animation easing curve |
| `--shadow` | `0 8px 28px oklch(25% .009 60 / .06)` | Elevation shadow; embeds `oklch(25% .009 60 / .06)` |

> When scaffolding Tailwind, define these as theme values (v4 @theme or v3 theme.extend). Do not introduce shadcn default palettes. The original stylesheet is the authority; .docs/DESIGN.md is generated from it.

Fixed non-token values: headline letter-spacing is `-0.045em`, title letter-spacing is `-0.025em`, body text is `0.9375rem/1.5`, and DM Sans is bundled locally at `.template/assets/fonts/dm-sans-0.woff2` and `dm-sans-1.woff2` under the SIL Open Font License — `assets/fonts/OFL.txt` must be copied alongside the font files when the fonts are ported into `web/`.

## Data and domain contracts

Domain objects, invariants, and mutation contracts live in `.docs/DATA-CONTRACTS.md` and are framework-neutral. The deterministic calculation policy is in `.docs/CALCULATION-RULES.md`; the AI boundary is in `.docs/AI-CONTRACT.md`; all 40 UI state hooks are in `.docs/STATE-MATRIX.md`; test scenarios are in `.docs/ACCEPTANCE-TESTS.md`.

Global conventions from `.docs/DATA-CONTRACTS.md`:

- Stable opaque IDs, separately displayed business codes such as SKU/PO number. Never use a name as identity.
- Every operational record belongs to a store. Trusted reads/mutations verify membership; a client-provided store ID is not sufficient authorization.
- Store timestamps as UTC instants; retain IANA store timezone for interpreting reporting dates/cutoffs. A business date is not interchangeable with an instant.
- Quantities carry base unit and approved precision. Most fixture goods use integer `each`; fractional stock needs an explicit policy and unit model.
- Money carries ISO currency and decimal/minor-unit precision. Use exact decimal arithmetic or carefully validated integer minor units. Do not assume all currencies have two decimals.
- Missing values use null plus a reason/state, not numeric zero. Unknown and verified zero are distinct.
- Version records and retain source provenance. Approval targets immutable content and relevant source versions, not mutable UI state.
- User/supplier/import/model text is escaped data. Do not render arbitrary HTML or execute suggested links/actions.

## Contributing

1. One owner per task — never two agents editing the same file concurrently.
2. Never edit anything in `.template/` or `.docs/` — they are verbatim delivered reference material.
3. Record unresolved business policy in `docs/decisions/` rather than inventing a default.
4. Every change states a bounded plan up front and reports changed paths plus verification evidence.
5. Never commit or push without explicit owner authorization.

## Documentation map

| Document | Read this when… |
|---|---|
| `.docs/README.md` | You need to locate any delivered document — it indexes the whole pack. |
| `.docs/AGENTS.md` | You want the delivered implementation guidance this repo's AGENTS.md summarizes. |
| `.docs/PRODUCT-BRIEF.md` | You need the product scope, users, and problem statement. |
| `.docs/BASELINE.md` | You need to know exactly what the delivered static baseline contains. |
| `.docs/DESIGN.md` | You are building UI or configuring Tailwind tokens from the design system. |
| `.docs/UI-UX-GUIDE.md` | You need screen composition, component, and interaction guidance. |
| `.docs/BACKLOG.md` | You are picking the next task from the ordered queue. |

The remainder of .docs/ is indexed in .docs/README.md.
