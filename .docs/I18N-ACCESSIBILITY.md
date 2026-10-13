# Internationalization and accessibility contract

Confirmed: English/USD defaults and selectable country/language/currency. Delivered controls include country/timezone context. Production translations, currency conversion and complete worldwide legal/commercial support are not implemented or established by those options.

## Regional model

Persist country ISO code, locale/BCP-47 language tag, ISO currency and IANA timezone independently. Country may suggest options only under approved UX; never override owner choice silently. Refresh country/currency/timezone datasets at implementation rather than treating the template snapshot as permanent authority.

The template contains 249 country/territory choices, 154 tender currencies, 35 languages and 448 timezones. Presence in a selector is not proof of translated strings, provider market availability or supported financial rules.

## Language and copy

Use full translation keys with pluralization and interpolation. Avoid concatenating fragments such as a currency amount plus English-only grammar. Do not translate SKUs, legal supplier names or historic approval text as though they were current product labels.

Define supported locale list, fallback and language-name display in D-12. Show honest fallback when UI language is unavailable. Set document `lang`; annotate mixed-language content. The German sample uses `lang="de"`; Arabic uses `lang="ar" dir="rtl"`. Preserve those annotations through component extraction.

DM Sans assets cover Latin/Latin-ext, not all scripts. Use appropriate local/system fallback or licensed localized fonts. Test glyph coverage, line-height, Arabic shaping and CJK wrapping.

## Money and units

Money retains ISO currency and exact precision. Locale formatting is display, not conversion. A USD document stays USD after the user selects EUR. Different currencies cannot become one trusted total without approved rate/source/time/rounding policy. Test zero-, two- and three-decimal currency formats.

Base units and packs remain visible and translatable where appropriate. Do not assume metric/imperial conversion is implemented. Supplier unit cost must refer to the same base unit used for line calculation.

## Dates and calendars

Store operational instants in UTC; interpret business dates/cutoffs with explicit store timezone. Distinguish snapshot instant, daily sales date, requested delivery date and unconfirmed estimate. Test daylight-saving changes, midnight boundaries and ambiguous local times. Never silently use browser timezone in purchasing policy.

Import date/number formats need explicit choices when ambiguous. `01/02` cannot be guessed as January2 versus February1. Comma decimals and thousands separators must not be parsed by locale-blind rules.

## RTL and responsive layout

Use logical inset/margin/padding/alignment. Mirror directional navigation arrows when semantically appropriate, not logos, product art or numbers indiscriminately. Keep table identity and numeric alignment legible. RTL testing requires actual browser layouts, not adding `dir` alone.

Text expansion: long supplier names and translated actions wrap. Test 320px width and 200% text zoom. Dense tables scroll inside their own region. Do not truncate a key warning or product identity to make a screenshot tidy.

## Accessibility target

Target WCAG 2.2 AA patterns. This pack/template is not a certification. Requirements:

- One main landmark and meaningful h1/title; skip navigation and accurate route focus.
- Visible labels and associated help/errors; `aria-invalid` only when applicable.
- Tables with captions/scoped headers; labeled keyboard-focusable scroll region.
- Text/icon status, not color alone; meaningful disabled reasons.
- Visible keyboard focus, no traps; native controls where possible.
- Sufficient rendered text/nontext contrast, including selected/disabled/error states.
- Appropriate target sizes; 44px primary/touch controls as project guidance.
- Reduced-motion and forced-colors support.
- Dynamic saves/results announced intentionally; no repetitive whole-table live output.
- Destructive actions describe consequences and have accessible cancel/recovery.

## Manual verification

Test keyboard traversal, screen reader labels/errors/announcements, zoom/reflow, touch device behavior, target evergreen browsers, print and translated/RTL examples. Use automated axe to locate issues, but inspect incomplete rules rather than counting them as passes. Clipped mobile table contrast was incomplete in the static audit; preserve that caveat and validate actual visible cells in integration.

Tests: T-02/T-03/T-04/T-05/T-15/T-22/T-25. Record browser/device/assistive tool and outcomes, not a generic “accessible” claim.
