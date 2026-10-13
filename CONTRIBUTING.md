# Contributing to StockLoop

Thanks for helping build StockLoop — an inventory purchasing copilot for
neighbourhood retailers. It turns stock and sales data into reviewable restock
proposals that a human owner approves. It is **not** autonomous purchasing.

## Prerequisites

- Node >= 20 with pnpm
- Python 3.12 with `uv`
- Docker with Compose v2+
- GNU make

## Local setup

```sh
make env        # copies .env.example to .env if not already present
make db-up      # starts the local Postgres container
make db-logs    # follows the Postgres logs
make db-down    # stops the local stack
```

`make env` copies `.env.example` to `.env`. The local Postgres listens on host
port **5433** — deliberately not 5432, so it never collides with a Postgres you
may already run. Do not change it to 5432 unless you have disabled your own
instance.

To view the static UI reference: `make template` serves `.template/` on
`http://localhost:4173`.

Commands beyond the above do not exist yet. Do not add or reference make
targets that are not in the `Makefile`.

## Reference material is read-only

`.docs/` and `.template/` are verbatim delivered reference material. **Never
edit them** — PRs touching them will be rejected, and CI enforces this.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `chore:`, `refactor:`, `test:`. One type, colon, imperative
summary. The type keeps history scannable and lets changelogs and releases be
generated later without archaeology.

## Branch naming

`<type>/<short-slug>` — e.g. `feat/inventory-table`, `fix/currency-rounding`.
Same type vocabulary as commits.

## Pull requests

- Small and focused: one concern per PR.
- State a bounded plan in the PR body (what you will and will not do).
- Report changed paths and verification evidence: the actual command and its
  observed result, not "it works".
- Never commit or push without owner authorization. Never merge your own PR.

## Security

- Never commit real credentials, tokens, or `.env` files.
- Never report vulnerabilities in a public issue — use the private process in
  `SECURITY.md`.

## Architectural invariants

Do not break these, in any contribution:

1. A human always approves a purchase proposal. Nothing is ordered without that
   approval.
2. Deterministic rule code is authoritative; AI output is advisory only.
3. Unknown stock, cost, or history is **not** zero — it is unknown. Defaulting
   unknowns to zero corrupts every downstream calculation.
4. Currencies are never summed across a single budget total without an
   approved conversion policy.

Open business-policy questions are recorded in `docs/decisions/` (see
`docs/decisions/README.md`) rather than being silently defaulted in code. If a
change depends on an undecided policy, point at the decision record — do not
invent a default.
