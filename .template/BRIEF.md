# StockLoop: confirmed HTML template brief

## Feature summary

A high-fidelity, responsive static UI kit for an inventory purchasing copilot serving small neighborhood retailers. The frontend team will slice semantic HTML and implement all logic. The deliverable is a ZIP attached directly in the originating chat; no deployment, backend, framework, or runtime JavaScript.

## Primary action

Identify products needing replenishment, understand inputs and constraints, review quantities and budget, and explicitly approve supplier-specific purchase-order drafts.

## Confirmed direction

The user selected Cornerstore on 13 October 2026 after reviewing the proposed scope and design direction. Personality: friendly, practical, confident. Restrained color strategy: warm mineral-paper surfaces, charcoal text, terracotta primary actions, and sage/amber/red statuses with text labels. Physical scene: a shop owner checks a laptop on a brightly lit shop counter between customers, needing clear next actions without glare or visual noise. Anchor references: Square Dashboard task clarity, Muji shelf-label precision, Apple Numbers readable data.

## Scope

Nineteen standalone HTML screens: overview, inventory, product detail, reorder studio, purchase-order list, purchase-order document, suppliers, supplier detail, data imports, import mapping, import validation, import completion, sign in, registration, regional onboarding, first-run welcome, settings, state gallery, and component gallery. Navigation and native disclosures/select controls are presentation only. Shared CSS and local assets keep the ZIP portable and ready to slice. No real import, calculations, authentication, AI, persistence, translations, or exports.

## Layout

A quiet left navigation on desktop, native expandable navigation on narrow screens, an open operational summary strip, a priority inventory table, and a distinctive apricot order-review rail. Secondary screens keep the same vocabulary. Purchase orders resemble readable business documents rather than dashboards. Onboarding makes country, language, currency, and timezone choices explicit.

## Key states

First run, demo data, loading, empty search, missing/stale/duplicate/invalid imported data, zero recent sales versus missing history, actual versus projected stockout, delivery gaps, case size, MOQ, insufficient budget, AI loading/unavailable/invalid output and deterministic fallback, edited quantities invalidating approval, partial approval, stale approval, multi-supplier and currency mismatch, export blocked/failure/success, offline/unsaved data, permission errors, successful saves, long names, and inline destructive confirmation.

## Locale

User requirement: support countries with their currencies; default English and USD; registration/onboarding lets the user choose language and currency. Include country and timezone context and editable regional preferences in settings. Controls and integration notes must not claim complete translations or automatic currency conversion exist. Use ISO country and currency codes in selectors; RTL-ready CSS uses logical properties where applicable.

## Interaction boundary

Links navigate to explicitly labeled example fixtures. Native details disclose filters and state samples; form controls can be edited but do not save or recalculate. All screens show static/demo context. No inert fake links, no network submission of credential inputs, no hidden business calculations.

## Content

Fictional Maple & Main shop. Default USD. Four illustrative replenishment lines: 48 oat milk units at $2.50, 30 rice units at $4.00, 96 noodle units at $0.75, and 48 water units at $1.50, totaling $384 across two suppliers against a $500 budget. Oat milk: 12 units on hand, average 4/day, 5-day lead time; 3 days of cover leaves a 2-day delivery gap. Sample recommendation input assumptions are shown, not evaluated by the template.

## Implementation references

Impeccable product, craft, spatial-design, typography, interaction-design, color-and-contrast, responsive-design, ux-writing; audit/critique for handoff verification.

## Visual probe outcome

A two-direction north-star/probe image was requested using the available image-generation service. It failed with HTTP 429 quota exhaustion. No images were produced. The user subsequently approved the written Cornerstore direction and screen coverage; image exploration is skipped after this evidenced provider failure. All final interface text and shapes remain semantic HTML/CSS/SVG.

## Verification

Inspect desktop, tablet, and narrow mobile in Chromium. Check every HTML route and local asset, screenshot the principal flows, verify native navigation/disclosures and keyboard focus, inspect page overflow and console errors, and validate ZIP integrity. No production claims for unimplemented app behavior.
