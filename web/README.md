# StockLoop web

React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (pnpm). The Cornerstore
design system from `/README.md` is the authority: the stylesheet is ported
verbatim to `src/styles/cornerstore.css`, mirrored as CSS custom properties in
`src/index.css`, and mirrored again as the Tailwind theme in
`tailwind.config.ts` (20 colors, fonts, text sizes, radii, spacing, sidebar
width, easing, shadow). Do not add shadcn default palettes or any color not in
that token list.

## Scripts

| Command                             | What it does                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                          | Vite dev server on :5173, `/api` proxied to `http://localhost:8000` |
| `pnpm build`                        | `tsc --noEmit` + production bundle                                  |
| `pnpm typecheck`                    | `tsc --noEmit`                                                      |
| `pnpm lint`                         | `eslint .`                                                          |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                              |
| `pnpm test`                         | Vitest run (jsdom)                                                  |

## Mock vs real API

`src/lib/api.ts` exports a single `ApiClient` implemented twice: `httpApi`
(real backend) and `mockApi` (fixtures in `src/lib/mock`). One toggle:

- default: fixture layer serves the acceptance demo (plan PLAN-001, totals
  384.00/222 units, budget 500.00 · 76.8% used, tax/shipping excluded)
- `VITE_USE_MOCK=false pnpm dev` → real API through the dev proxy

## Structure

- `src/components/layout/` — app shell ported from `.template/index.html`:
  skip link, sprite, 224px sidebar, `<details>` mobile nav, header, PageHead.
- `src/components/ui/` — shared primitives: Button, Field, Input, Select,
  Textarea, QuantityInput, StatusPill, Table (labeled scroll region),
  Disclosure, InlineNote, Toast, CoverageBar, BudgetMeter.
- `src/lib/` — typed API contract, money helpers (integer minor units), the
  deterministic calculation rules from `.docs/CALCULATION-RULES.md`.
- `src/pages/` — one placeholder per route with the correct `<h1>`; replace
  the bodies, keep the shell contract (one h1 + one main per route).

Fonts: DM Sans is bundled under the SIL Open Font License —
`public/fonts/*.woff2` with `OFL.txt` alongside. Keep the license file when
moving fonts.
