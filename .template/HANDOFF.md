# StockLoop template handoff

## Scope and ownership

This ZIP is a static UI reference, not an application. The team implementing the app owns registration/authentication, permissions, routing, data persistence, translations, currency formatting/conversion, CSV parsing, stock estimates, deterministic purchase constraints, AI calls, approvals, exports, audit events, notifications, and supplier transmission (if later added). No backend has been scaffolded.

## Component boundaries

| Component | HTML anchor / CSS vocabulary | Integration notes |
|---|---|---|
| App shell | `.sidebar`, `.mobile-nav`, `.app-header`, `.main` | Replace page links with your router. Preserve `aria-current`, native mobile disclosure and skip link. |
| Page heading | `.page-head`, `.eyebrow`, `.page-head-actions` | Keep the primary action consistent. Headlines are fixed rem product typography, not fluid display type. |
| Buttons | `.btn`, `.primary`, `.ghost`, `.danger` | Fixture navigation uses links; real actions should be buttons. Provide disabled/loading/error/success behavior. |
| Fields | `.field`, `.field-grid`, `.control`, `.qty` | Every input has a visible or explicit label. Tie validation hints and errors to `aria-describedby`. |
| Status | `.pill`, `.good`, `.warn`, `.bad`, `.info` | Keep text and optional icon, not color alone. Stock status and approval status are different enums. |
| Tables | `.table-scroll`, `.data-table`, `.priority-table`, `.reorder-table` | Keyboard-focusable scroll region, semantic headers and captions. Respect base units versus cases. |
| Product identity | `.product-line`, `.product-thumb`, `.product-name` | Replace fictional SVG images and SKU references with data. Long names wrap. |
| Coverage | `.coverage` | CSS width is illustrative only. Define finite, unknown, zero-sales and stale branches in the application. |
| Recommendation context | `[data-component="recommendation-context"]`, `.decision-sheet` | Separate inputs, rule checks and AI explanation. Never treat AI text as a purchasing authority. |
| Order review | `.order-summary`, `.budget-meter`, `.checklist` | The meter must use validated totals in one currency. Update quantity/case counts and invalidate old approval on edits. |
| Inline feedback | `.inline-note`, `.toast-sample` | Recovery paths must be real after integration. Add live regions only to changes needing announcement. |
| Disclosure | `.disclosure`, `.table-disclosure` | Native details/summary is a zero-JS starting point. Keep explanations accessible on touch and keyboard. |
| Import progress | `.step-nav`, `.dataset-row`, `.upload-zone` | Steps currently navigate fixtures. Enforce readiness, file acceptance and validation policy in the app. |
| Document | `.document`, `.document-*`, `@media print` | Bind one supplier/currency per document; revalidate approved input version before export. |
| State fixtures | `states.html [data-state]` | Each data-state is an explicit variant hook. Examples are mutually exclusive, not a working state machine. |

## Recommended application models

These are integration notes, not implementations:

- **Regional preferences:** country ISO alpha-2, language/locale tag, currency ISO code, IANA timezone, date/number display preferences. Country does not automatically change currency without explicit user consent.
- **Inventory inputs:** stable SKU, stock quantity/base unit, snapshot timestamp, sales window and demand signal. Unknown stock/history is not zero. Verified zero sales must avoid division by zero.
- **Supplier terms:** supplier ID, contact, document currency, unit cost, lead time, purchase pack size, MOQ/minimum order value, delivery window and cutoff. Product-specific overrides are explicit.
- **Purchasing plan:** source snapshot version, deterministic assumptions, suggested quantity, edited quantity, case quantity, costs, constraints, unresolved delivery risks, explanation source (`AI` or `rule-based`).
- **Approval:** owner, timestamp, immutable reviewed version, currency and validated totals. Any relevant edit or new stock/terms must invalidate or require reapproval.
- **Purchase order:** one supplier, original currency, approved version, per-line base units and packs, subtotal, tax/shipping treatment and export state. A completed export is not supplier acceptance or order placement.

## Fixture routes that must become real logic

Links labeled `fixture`, `state`, `example`, `preview`, or `template` deliberately navigate to authored examples. Do not ship them unchanged as real save, approve, import, register, or export actions. No form has an external submit target. There are no runtime scripts.

Only oat milk, Freshfield Foods and PO-2026-0142 have detail fixtures. Other record names are plain text; retained example actions identify the shared fixture or state they open rather than pretending to load a matching record.

Search and filtering controls do not change rows. Quantity edits do not recalculate. Registration never creates an identity. Selecting a file never reads it. State-gallery success messages must be driven by verified outcomes after integration.

## Sample arithmetic and assumptions

The primary purchasing example uses one currency, USD:

| Item | Base units | Purchase packs | Unit cost | Items total |
|---|---:|---:|---:|---:|
| Oat milk | 48 | 4 × 12 | $2.50 | $120.00 |
| Jasmine rice | 30 | 5 × 6 | $4.00 | $120.00 |
| Instant noodles | 96 | 4 × 24 | $0.75 | $72.00 |
| Sparkling water | 48 | 4 × 12 | $1.50 | $72.00 |
| **Plan total** | **222** | | | **$384.00** |

Freshfield Foods: $240.00. Daily Goods Co.: $144.00. Budget: $500.00; illustrative remaining: $116.00. Tax and shipping are not calculated or included.

Oat milk example: 12 on hand ÷ 4 average daily units = 3 days of cover versus a 5-day lead time. The calendar-day estimate leaves at least a 2-day delivery gap even when purchasing more units. Oct 18, 2026 is Sunday; Freshfield's regular delivery window is Monday to Friday, so availability and the actual gap need confirmation. No calendar scheduling is implemented. The sample target is 7 days plus 5 lead-time days plus 2 safety days; 56 gross needed units less 12 on hand = 44, rounded to 48 for 12-unit cases. The field values and reasoning are author-written fixtures, not runtime formulas.

## State gallery coverage

40 examples cover: empty inventory, demo mode, loading, empty search, import blockers, missing mappings, duplicate records, missing stock/history, missing supplier terms, stale data, zero sales, actual stockout, projected delivery gap, pack/MOQ rounding, budget shortfall, invalid/edited quantity, currency mismatch, AI loading/failure/fallback/invalid output, pending/complete/stale approval, export loading/failure/success, save confirmation, notifications, offline, unsaved edits, permissions, product/supplier forms, sign-in/reset states, locale changes, long text, RTL composition and destructive confirmation.

## Internationalization contract

The selects contain local option markup so the ZIP is portable. Option values use ISO/BCP-47/IANA identifiers, not display names. They are not a complete translated product.

- English and USD are the default template values. Persist actual user choices in your app.
- Use full translation strings, with pluralization and locale-aware number/date formatting. Do not concatenate sentence fragments.
- Use a suitable font fallback or localized font asset for scripts outside bundled Latin/Latin-ext glyphs.
- Set `<html lang>` and `<html dir>` when changing locale. Mirror only directional icons where semantically correct.
- Preserve ISO currency and minor-unit precision for historical documents. Zero-, two-, and three-decimal currencies need distinct formatting rules.
- Do not label a USD amount as EUR merely because preferences changed. Exchange rates require explicit policy, date, rounding and source.
- Model sales windows and order cutoffs in the store timezone. Do not use browser-local time as a hidden substitute.
- The current-country/currency lists are static snapshots. Refresh them and define your genuinely supported language set before launch.

## Accessibility and responsive contracts

Preserve one page-level h1, one main landmark, skip link, labels, `aria-current`, table header semantics, error associations, visible keyboard focus and no-JS mobile navigation. Keep meaningful copy on every disabled action.

Dense tables intentionally scroll within their component. The page itself must not overflow. Native controls accept keyboard input; don't replace them with inaccessible visual imitations. Respect reduced-motion settings. Automated checks supplement, not replace, screen-reader and real-device testing.

## Asset rights

Original local brand/product/shelf SVG illustrations are supplied for this template. DM Sans is bundled under the SIL Open Font License in `assets/fonts/OFL.txt`. No remote CDN, tracking, product photography, or image-generation assets are required.
