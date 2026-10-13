# Optional extensions: discovery only

Status: **UNCONFIRMED**. These ideas were mentioned by an earlier assistant, not established by user requirements in the available brief. They are not delivered screens, core MVP tasks or permission to build/send anything. Promote only after D-14 is accepted and a task-specific UX brief is confirmed.

## EXT-01: customer-intent capture

Potential goal: record a shopper's request when stock is unavailable, so the owner can inspect unmet need.

**Discovery questions:** Is this entered by staff or shoppers? Does it need customer identity? What is consent/retention policy? Is the request a product/category/free text? Is it a request count or requested quantity? What creates/resolves/deduplicates it?

**Possible UI, proposed:** small staff-entered form adjacent to product/stockout context, with requested item, quantity/unit, timestamp and optional reason. Prefer anonymous aggregate signals unless identity is justified. Keep free text escaped and minimized.

**Required states:** no matches, unknown SKU, duplicate request, saved/error, offline/unsaved, withdrawn/resolved and permission denied.

**Hard boundaries:** a request is not a sale, reservation or consent to contact. Do not add it directly to measured daily sales. No promise of replenishment or customer follow-up without actual policy/integration.

## EXT-02: alternative products

Potential goal: show available substitutes during a stockout or purchasing gap.

**Discovery questions:** Who curates suitability? Are ingredients/allergens/dimensions/price constraints important? Is substitution customer-facing or only procurement? What evidence supports equivalence? How are stock/currency/time checked?

**Possible UI, proposed:** related products in the detail screen with explicit “Alternative to review,” reason, differences, availability timestamp and price unit. Avoid unsupported “equivalent” claims. Compare meaningful constraints rather than a cosmetic product-card grid.

**Required states:** no curated alternative, stale stock, missing attributes, incompatible units/currency, uncertain suitability and owner rejection.

**Hard boundaries:** AI similarity is not safety certification or customer consent. No silent supplier/SKU swap inside an approved order. Selecting an alternative creates a newly validated plan line/version and reapproval.

## EXT-03: unmet-demand view

Potential goal: summarize request observations separately from sales to help owner planning.

**Discovery questions:** Count events versus units? Window and deduplication? Anonymous/customer data? Staff bias? How should low-sample/stale signals affect purchasing? Does approval policy allow demand adjustment?

**Possible UI, proposed:** a compact demand-signal table with window, observed requests, provenance, completeness and caveats. Keep separate columns for recorded sales and unmet-request signals. No fake revenue forecast.

**Required states:** no signals, incomplete capture, duplicates, stale window, excluded observations and low sample.

**Hard boundaries:** unmet requests are not lost-revenue measurements or guaranteed future demand. Do not merge with sales/average formula without an explicitly approved model and validation tests.

## EXT-04: supplier email

Potential goal: send an approved document to a verified supplier contact after explicit review.

**Discovery questions:** Sender/domain/provider? Verified recipient? Attachments? Are messages draft-only or sent in-app? What retry/reconciliation/audit policy? Are legal/commercial order-placement implications understood?

**Possible UI, proposed:** distinct compose/review step after document approval/export. Show actual recipient, subject, body, attachment, approved version and explicit send action. Do not hide sending inside export.

**Required states:** missing/invalid recipient, sandbox mode, draft/dirty, sending, provider accepted, unknown outcome, failed/bounced, stale attachment and permission denied.

**Hard boundaries:** email send requires owner authorization and approved credentials/recipient. Provider acceptance is not supplier acceptance or delivery. A timeout can still have sent the message; reconcile before retrying. Use idempotency/correlation and immutable approved attachment. Never automatically resend a purchasing message because the UI timed out.

## Promotion checklist

1. Owner supplies intended requirement and accepts D-14 for a specific extension.
2. Confirm user/persona, data/consent, authority and measurable outcome.
3. Shape the UX using Cornerstore, with primary action/state/mobile brief.
4. Define new domain, data and security contracts without weakening core invariants.
5. Add separate tasks/tests and dependencies; do not quietly enlarge SL-01–SL-17.
6. Implement only under the new authorized scope. External communication remains separately gated.

No corresponding application code or new HTML screens were created for these ideas in this documentation task.
