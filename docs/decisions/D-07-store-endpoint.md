Decision ID: D-07 (store endpoint — ID collides with the register's D-07 "stock snapshot replace versus movement/merge"; kept as instructed, owner should renumber one of the two on review)
Status: proposed — implemented provisionally
Owner and source/date: unassigned — proposed by the M2 implementation agent, 2026-10-16; awaiting owner confirmation.
Question: What is the contract of `GET/POST /api/store` — payload shape, field naming, concurrency control, role gating, and what happens to existing documents when the region fields change?
Options considered:
1. PATCH-style snake_case bodies mirroring the DB columns: least conversion code, but splits naming conventions from every other endpoint and from the frontend.
2. camelCase JSON bodies with optimistic concurrency via `expectedVersion` (chosen): matches the JSON envelope already used by `/api/auth/*` and `/api/preferences`, gives lost-update protection for two admins editing the same store.
3. Last-write-wins (no version field): simplest, silently loses concurrent edits; unacceptable once two operators share a store.
4. Pessimistic locking (SELECT ... FOR UPDATE / lock rows for the request): protects writes but holds locks across admin UI round-trips, overkill for a single-row table.
Accepted policy (provisionally implemented, NOT accepted):
- `GET /api/store` → 200 with `{ "store": {...}, "preferences": {...} }`. `store` is `StoreOut`: `id`, `name`, `countryCode`, `locale`, `defaultCurrency`, `timezone`, `version` — all camelCase. `preferences` is the caller's own `PreferencesOut` (read fallback; preferences are never store-wide).
- Auth: session cookie required (`get_session_user` + `get_store`); no cookie → 401. The store is resolved from the session's membership row, never from a client-supplied id.
- `POST /api/store` → `StoreUpdate` body: `name?`, `country?`, `locale?`, `defaultCurrency?`, `timezone?`, `expectedVersion?`. Any subset may be sent; absent fields are untouched. Response 200 `{ "store": {...}, "version": <new> }`.
- Optimistic concurrency: if `expectedVersion` is present and != `store.version`, respond 409 `{ "code": "version_conflict", "message": "Store was modified by another user", "currentVersion": <current> }`. The client re-fetches and retries. Omitting `expectedVersion` skips the check (allowed but not recommended for multi-admin stores).
- Validation: each supplied region field is checked against `app/region_data.py` (`country`→`is_valid_country`, `locale`→`is_valid_language`, `defaultCurrency`→`is_valid_currency`, `timezone`→`is_valid_timezone`); unknown value → 400 `{ "code": "invalid_country" | "invalid_language" | "invalid_currency" | "invalid_timezone", ..., "field": <field> }`.
- Concurrency bump: `version` increments only when at least one field actually changed; an all-null or no-op body returns the unchanged `version`.
- Roles: operator and owner may POST; viewer → 403 (see `docs/decisions/D-04-roles.md`). GET is open to every authenticated member.
- Region-change semantics: changing country/locale/currency/timezone never relabels historical documents — orders keep their original currency; changing country alone never changes currency (T-05, DATA-CONTRACTS).
Reason/tradeoff: camelCase + `expectedVersion` costs one mapping layer but keeps one convention across the API and gives correct multi-admin behaviour with a single-row table. Pessimistic locking was rejected as heavyweight for one row; last-write-wins was rejected because the settings screen shows `version` and the frontend already has a conflict-retry path.
Affected features / contracts / tests / tasks: `api/app/routers/store.py`, `api/app/schemas.py` (StoreOut/StoreUpdate/StoreResult/StoreWithPreferences), `api/app/deps.py` (get_store, require_role); tests `api/tests/test_authorization.py`, `api/tests/test_session.py` (persistence/T-05), frontend `pages/settings.tsx` conflict flow; Phase 4 E2E (stale `expectedVersion` → 409 with `currentVersion`).
Migration or compatibility impact: None — `store.version` ships with the initial schema (alembic 0001).
External authorization needed: Owner must confirm (a) that `POST /api/store` stays operator-and-above, (b) that `expectedVersion` remains optional rather than required, and (c) the document-relabelling rule (orders keep original currency) for production.
