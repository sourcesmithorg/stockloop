Decision ID: D-04
Status: proposed
Owner and source/date: unassigned — proposed by the M2 implementation agent, 2026-10-16; awaiting owner confirmation.
Question: Which roles exist, what may each do, who can approve plans and export purchase orders, and how are memberships revoked?
Options considered:
1. Single-admin model (owner-only): simplest, no delegation, blocks staff workflows.
2. Three roles owner/operator/viewer with owner-only approval: matches the delivered pack's approval invariant while delegating day-to-day operation.
3. Fine-grained ACL (per-endpoint permissions): maximum flexibility, high design/maintenance cost with no pack requirement backing it.
Accepted policy (provisionally implemented, NOT accepted):
- Roles: `owner`, `operator`, `viewer`, stored as a string on `membership.role`.
- Matrix (as implemented in `api/app/deps.py::require_role` and the routers):

  | Capability | owner | operator | viewer |
  |---|---|---|---|
  | Read all operational data (products, inventory, plans, orders, suppliers, imports) | yes | yes | yes |
  | Edit own display preferences (`POST /api/preferences`) | yes | yes | yes |
  | Preview/commit imports (`/api/imports/*`) | yes | yes | 403 |
  | Edit plan lines (`POST /api/plans/{id}/lines/{id}`) | yes | yes | 403 |
  | Edit store identity/region (`POST /api/store`) | yes | yes | 403 |
  | Approve a plan (`POST /api/plans/{id}/approve`) | yes | 403 | 403 |
  | Manage memberships / change roles | not implemented (OPEN) | 403 | 403 |

- `require_role()` with an empty allow-list means owner-only (approve).
- Cross-store access returns 404 (no existence leak), never 403.
- Store scoping is resolved from the session's membership row; a client-supplied store id is never trusted.
Reason/tradeoff: Approval is the pack's invariant gate (approval freezes immutable snapshots that purchase orders derive from), so it stays owner-only. Delegated day-to-day operation (imports, plan-line corrections, regional setup) is what an operator role exists for. Viewers are read-only plus their own preferences — preferences are self-scoped, not store data. A fine-grained ACL was rejected as unearned complexity for M2.
Affected features / contracts / tests / tasks: `api/app/deps.py` (require_role), routers: plans (line edit, approve), imports (preview, commit), store (update), preferences (self-scoped); tests `api/tests/test_authorization.py`; E2E viewer-403 checks. Revocation (removing a member / deactivating a membership) is NOT yet implemented — `membership.status` exists and `load_session_user` rejects non-`active`, but no endpoint flips it. Partial approval and per-line approval are OPEN and unimplemented.
Migration or compatibility impact: None for existing data (new tables). `membership.status` defaults to `active`.
External authorization needed: Owner must confirm the matrix, especially (a) whether approve should stay owner-only or allow operators, and (b) the membership-revocation workflow before it is built.
