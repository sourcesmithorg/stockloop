# Verified template baseline

Baseline date: 13 October 2026. All UI paths below belong to the separately delivered HTML kit. None are included in this Markdown-only archive.

## Delivered artifact

`stockloop-html-template.zip`: 44 files, 206507 bytes. SHA-256: `dc78ae4840313cf2f084d88ae2f5cd1bf550e28444c4f060ad88ff3a39b15225`.

The kit is plain HTML/CSS with local fonts, original SVGs, five small CSV examples and documentation. It opens offline through `index.html`. Its native select/input/disclosure values can change visually, but nothing is saved, parsed, calculated or authenticated.

## Screen inventory and future integration targets

Proposed routes are examples for an authorized application build, not a selected router or paths already implemented.

| Template | Purpose | Proposed app route | Important integration change |
|---|---|---|---|
| `index.html` | Overview, priority stock, review rail | `/overview` | Bind scoped counts, freshness and proposal totals |
| `inventory.html` | Search/filter stock list | `/inventory` | Genuine query/pagination; preserve unknown/zero distinctions |
| `product.html` | Oat-milk detail fixture | `/inventory/:productId` | Correct product identity, timeline and explanation |
| `reorder.html` | Editable review studio | `/plans/:planId` | Recalculate, version, validate and invalidate approval |
| `orders.html` | Order history/status fixtures | `/orders` | Correct document ID/supplier/currency per row |
| `order.html` | Freshfield PO-2026-0142 fixture | `/orders/:orderId` | Bind immutable approved document and export eligibility |
| `suppliers.html` | Supplier directory | `/suppliers` | Real completeness/filtering, correct record routes |
| `supplier.html` | Freshfield detail fixture | `/suppliers/:supplierId` | Contact, terms and calendar validation |
| `imports.html` | Dataset readiness and file picker | `/imports` | File handling, limits, import job lifecycle |
| `import-mapping.html` | Column/format mapping | `/imports/:importId/mapping` | Dataset schema, preview and required-field checks |
| `import-validation.html` | Row errors/warnings | `/imports/:importId/validation` | Authoritative counts and correction/download behavior |
| `import-complete.html` | Success fixture | `/imports/:importId/result` | Verified persistence before success |
| `login.html` | Sign-in composition | `/login` | Real auth and accessible failures |
| `register.html` | Registration composition | `/register` | Real validation, account lifecycle and privacy notice |
| `onboarding.html` | Store/regional choices | `/onboarding` | Persist preferences without automatic money conversion |
| `welcome.html` | First-run/no data | `/welcome` | Real readiness and explicitly isolated demo mode |
| `settings.html` | Store/region/policy preferences | `/settings` | Dirty state, validation, save and conflict recovery |
| `states.html` | 40 mutually exclusive examples | Development-only gallery | Never use success anchors as real operations |
| `components.html` | Visual vocabulary | Development-only gallery | Extract primitives without semantic regression |

## Asset and component map

- `assets/styles.css`: canonical shared styles, logical CSS properties, print styles, focus, reduced motion and forced-colors treatment.
- `assets/loop.svg`, `assets/shelf.svg`, eight `assets/product-*.svg`: ten original local illustrations.
- `assets/fonts/dm-sans-0.woff2`, `dm-sans-1.woff2`, `OFL.txt`: font binaries and license. Preserve license when copying fonts.
- `samples/inventory.csv`, `sales.csv`, `suppliers.csv`, `terms.csv`, `import-errors.csv`: tiny fictional examples, not production schemas or complete reporting periods.
- Component slicing hooks: HTML comments, `data-component`, semantic landmarks and shared class vocabulary.
- State hooks: `states.html [data-state]`. See [STATE-MATRIX.md](STATE-MATRIX.md).

Only **oat milk**, **Freshfield Foods** and **PO-2026-0142** have actual detail fixtures. Unsupported names were made plain text; retained example actions identify the shared fixture/state. Do not restore wrong-entity links during slicing.

## Coherent purchasing fixture

| Item | Base units | Packs | Unit cost USD | Line total USD |
|---|---:|---|---:|---:|
| Oat milk | 48 | 4 × 12 | 2.50 | 120.00 |
| Jasmine rice | 30 | 5 × 6 | 4.00 | 120.00 |
| Instant noodles | 96 | 4 × 24 | 0.75 | 72.00 |
| Sparkling water | 48 | 4 × 12 | 1.50 | 72.00 |
| Total | 222 | Mixed pack sizes | | 384.00 |

Freshfield: USD 240. Daily Goods: USD 144. Budget: USD 500. Remaining: USD 116. Utilization: 76.8%. Tax and shipping are excluded, not calculated as zero.

Oat milk has 12 on hand and a four-unit daily average, giving three days of cover. A five-calendar-day lead time leaves at least a two-day gap. Oct 18, 2026 is Sunday, while Freshfield's regular deliveries are Monday to Friday. The date is explicitly unconfirmed; the document requests delivery confirmation rather than promising Sunday arrival.

The SKU chart shows 13 days, Sep 30–Oct 12, totaling 52 units. Store-wide sales use a separate illustrative chart. The sample CSV has only a few rows and must not be used to infer those complete chart aggregates.

## Regional option snapshot

249 country/territory choices, 154 tender-currency choices, 35 language choices and 448 IANA timezone choices. Defaults: English and USD. These are static snapshots, not a claim of complete localization, legal market support or live currency conversion.

## Verified evidence, strictly static scope

- Chromium rendered all 19 pages at 1440, 768, 390 and 320 CSS pixels: 76 checks, no document overflow, missing images, page errors, runtime scripts or external page resources.
- Fourteen native presentation checks passed, including menu navigation, disclosure, select values, skip link, reduced motion, print shell removal and an RTL reflow example.
- Desktop and expanded-mobile automated accessibility checks detected no violations. Offscreen/clipped table-cell contrast rules remained incomplete/manual-review items.
- One-page A4 purchase-order preview retained lines, totals, delivery notes and the static/not-valid-order disclaimer.
- Source review identified five P2 issues, all corrected: wrong fixture records, Sunday delivery assumptions, SKU-chart consistency, suggestion-count scope and German `lang` annotation.
- Archive integrity and extracted local references passed; outbound ZIP matched the tested file byte-for-byte.

No manual screen-reader, real-device or cross-browser certification is claimed. Future application code needs its own complete verification. See `references/TEMPLATE-QA.md` for the original report.

## Preserve these regression fixes

Scoped table scrolling; min-width-zero responsive grids; contained screen-reader quantity labels; accessible budget meter; mobile/auth navigation landmarks; associated missing-SKU error; selected-tab contrast; correct detail identity; scoped “Restock suggestions” count; `lang="de"` on German and `lang="ar" dir="rtl"` on Arabic samples; one-page print layout without a visible skip link.
