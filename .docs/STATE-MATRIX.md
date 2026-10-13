# Existing state matrix

All 40 hooks below exist in `states.html` in the separate HTML kit. They are mutually exclusive static samples, not a working state machine. The triggers/transitions below are PROPOSED integration behavior. Preserve the visible state vocabulary and add real transitions only in authorized application work.

Each row's action must become real logic or remain unmistakably a fixture. `data-state` is a stable test/gallery hook, not authority to force a production operation's state.

| Hook | Trigger/meaning | UI and action expectation | Guard/transition | Feature |
|---|---|---|---|---|
| `empty-inventory` | No catalog/stock data | Explain required input; import action | Do not invent metrics | F-02/F-03 |
| `demo-mode` | Explicit demo session | Demo banner and exit-to-own-data | Isolate from operational writes | F-01 |
| `inventory-loading` | Query pending | Stable skeleton and pending label | No stale healthy claim | F-03 |
| `empty-search` | Query has no matches | Show filters/query and clear action | Distinguish no inventory | F-03 |
| `import-invalid` | Blocking row/schema issues | Counts, fields, corrections | Commit blocked under approved policy | F-02 |
| `mapping-incomplete` | Missing required mapping | Associated field error and reason | Continue disabled until valid | F-02 |
| `duplicate-record` | Duplicate/conflicting key | Explain keys/conflicts; choose approved resolution | Never silent merge/double count | F-02 |
| `missing-data` | Stock/history unavailable | Unknown value and correction path | No zero/default cover | F-03 |
| `missing-supplier` | Missing linked supplier/terms | Affected SKU plus missing fields | Affected proposal blocked | F-04/F-05 |
| `stale-data` | Source exceeds approved freshness | Timestamp and refresh impact | Revalidate affected plan | F-02/F-03 |
| `zero-sales` | Complete window, verified zero | “No recent sales,” no infinite cover | Separate missing history | F-03 |
| `out-of-stock` | Known stock equals zero | Actual stockout label and review action | Does not imply new order arrives now | F-03 |
| `delivery-gap` | Depletion before delivery estimate | Gap and calendar confidence | More quantity cannot remove timing gap | F-03/F-05 |
| `pack-moq` | Raw need rounded by terms | Raw/rounded units, packs, extra cost | Trusted pack/MOQ check | F-05 |
| `budget-shortage` | Selected total exceeds same-currency budget | Total/budget/shortfall and excluded risk | No silent removal | F-05 |
| `quantity-invalid` | Negative/off-pack/invalid units | Field error tied to input | Recalculation/approval blocked | F-05 |
| `quantity-edited` | Owner changed suggestion | Original/edit and new totals | New version; approval stale | F-05/F-07 |
| `currency-mismatch` | Incompatible currency groups | Original currencies and policy explanation | No scalar mixed-currency sum | F-05 |
| `ai-loading` | Provider request pending | Pending/current version; old advice labeled | Cannot make plan approved | F-06 |
| `ai-fallback` | AI unavailable or deterministic mode | Rule-based source label/retry | Same deterministic guardrails | F-06 |
| `ai-invalid` | Schema/constraint/version mismatch | Safe rejection and fallback | Reject candidate, no silent use | F-06 |
| `approval-pending` | Unreviewed or partially reviewed plan | Exact remaining review/groups | No export until eligible | F-07 |
| `approval-complete` | Trusted approval succeeded | Actor/time/version/scope | Only verified success | F-07 |
| `stale-order` | Relevant inputs changed | Change reason and re-review action | Old approval not current export permission | F-07/F-08 |
| `export-loading` | Artifact attempt pending | Progress/pending and retained preview | Deduplicate/reconcile attempt | F-08 |
| `export-error` | Verified artifact failure | Recovery/retry, preserve document | Failure is not approval revocation | F-08 |
| `export-success` | Verified artifact ready | Filename/supplier/version, retrieve action | Never “order placed” | F-08 |
| `save-success` | Trusted preferences/form save | Saved state/time as appropriate | Reload shows persisted result | F-01/F-04 |
| `notifications` | Informational event fixture | Meaningful message and navigation | Not a blanket new notification service | Shared |
| `offline` | Connection lost | Explain unavailable mutations, preserve edits | No fake online success | Shared |
| `unsaved-changes` | Actual dirty form | Save/discard/continue editing | Warn only when dirty | F-01/F-04/F-05 |
| `permission` | Actor lacks capability | Explain denied action/contact owner | Enforce server-side too | Shared |
| `product-form` | Create/edit catalog fixture | Identity/unit/terms with validation | Real save/version only if authorized | F-03/F-04 |
| `supplier-form` | Create/edit supplier fixture | Contact/calendar/currency/terms | Validate and invalidate affected plans | F-04 |
| `auth-error` | Authentication failed | Safe error, keep nonsecret input | No user-enumeration leak | F-01 |
| `password-reset` | Recovery fixture | Neutral provider-dependent flow | Do not imply email actually sent | F-01 |
| `locale-change` | Region preference changed | Historical-money impact explanation | No automatic conversion | F-01 |
| `text-expansion` | Long names/German action | Wrap without loss, `lang="de"` | No clipped primary action | Shared |
| `rtl-preview` | Arabic RTL sample | `lang="ar" dir="rtl"`, logical flow | Do not mirror numbers/logo blindly | Shared |
| `delete-confirmation` | Explicit destructive action | Inline consequence/confirm/cancel | Permission, dependencies, audit policy | Shared |

## Minimum additional application states

The gallery does not exhaust runtime behavior. Add, when the selected feature requires them: session expired, version conflict, import commit unknown, unsupported file encoding/size, incomplete reporting period, AI response stale, export outcome unknown, duplicate request and translation fallback. These are integration requirements for robustness, not new product screens by default.

## Transition rules

- Loading is not success. An unknown provider outcome is not failure until reconciled.
- Error messages identify scope and recovery; do not clear useful edits/previews.
- Save/approve/export success requires trusted persisted evidence.
- Input changes can turn valid → pending → blocked/valid and approved → stale. They cannot silently preserve prior approval.
- Colors render the state; CSS classes do not decide business eligibility.
- Announce asynchronous result/error changes accessibly without flooding live regions.

Tests: T-03/T-04/T-07–T-25 as appropriate. Link each selected state to the feature's actual runtime conditions and verify both transition and recovery, not just a screenshot.
