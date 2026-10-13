---
name: StockLoop Cornerstore
description: A thoughtful inventory purchasing UI for the neighborhood shop.
colors:
  primary: "oklch(51% .153 37)"
  primary-hover: "oklch(45% .145 37)"
  primary-soft: "oklch(95% .028 52)"
  background: "oklch(97.5% .006 70)"
  surface: "oklch(99.5% .003 70)"
  sidebar: "oklch(96% .009 70)"
  soft: "oklch(95.4% .006 70)"
  ink: "oklch(25% .009 60)"
  muted: "oklch(49% .011 60)"
  border: "oklch(88% .012 70)"
  control: "oklch(64% .015 70)"
  apricot: "oklch(94% .035 61)"
  success: "oklch(41% .07 156)"
  success-background: "oklch(94.5% .025 150)"
  warning: "oklch(42% .089 70)"
  warning-background: "oklch(96% .044 87)"
  danger: "oklch(44% .135 27)"
  danger-background: "oklch(96% .022 25)"
  info: "oklch(42% .06 235)"
  info-background: "oklch(95% .018 235)"
typography:
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.045em"
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
---

# Design System: StockLoop Cornerstore

## Overview

**Creative North Star: "The neighborhood shop's operating notebook"**

The confirmed direction is friendly, practical, confident. A shop owner checks stock on a laptop at a bright counter between customers. Light mineral-paper surfaces and dark readable type serve that scene; terracotta is reserved for the next useful action. Square Dashboard task clarity, Muji shelf-label precision, and Apple Numbers data readability are the visual anchors.

An open summary strip, quiet navigation, priority table, and apricot review rail lead from signal to decision. A readable supplier document provides a different topology from the app dashboard. Desktop uses a 224px sidebar; narrow layouts use native expandable navigation, single-column content, and component-scoped table scrolling. Four-point spacing provides rhythm rather than identical card padding everywhere.

**Key Characteristics:**
- Restrained accent use, meaningful semantic states, no status conveyed by color alone.
- One sans family, tabular numbers, visible input assumptions.
- No framework, runtime JavaScript, network assets, or hidden business behavior.
- Native disclosures and controls provide presentation behavior only.

## Colors

The frontmatter and `assets/styles.css` share canonical OKLCH tokens. Their perceptual values are intentionally retained instead of inventing a parallel hex source of truth. Consumers requiring strict Stitch hex validation must deliberately convert these values.

### Primary

Terracotta selects the active navigation item and primary action. Its deeper hover shade reinforces interaction. Apricot is the signature review surface, not a decorative coating over every component.

### Neutral

Mineral paper, near-white surface, charcoal ink, warm muted labels, subtle dividers and stronger control boundaries form the neutral layer. Pure black and pure white are not used as the UI palette.

### Semantic roles

Sage communicates a valid/complete state; amber asks for review; clay-red identifies blockers and actual risk; blue-gray supplies context. Text labels and icons remain present in every status.

**The One Action Rule.** The primary accent earns its place through action, selection, or risk-relevant emphasis. Inactive components do not compete with the purchase decision.

## Typography

DM Sans is self-hosted for Latin and Latin-ext. System/script-appropriate fallbacks must handle other languages after integration. The UI uses a single font family with fixed rem sizes. Product headings are not fluid marketing display type. Native monospace is used only for SKUs, order IDs and code hooks.

Headline, title, body and label roles are specified in frontmatter. Mobile body is 1rem, with larger operational metadata than the compact desktop tables. Numeric data uses tabular figures. Prose remains bounded to approximately 70 characters per line.

**The Quiet Data Rule.** Quantities and costs align consistently. Hierarchy comes from weight, spacing and position, not colorful oversized metrics.

## Elevation

Flat by default. Tonal layering and full subtle borders distinguish panels and state feedback. The printable document and toast sample use a restrained shadow: `0 8px 28px oklch(25% .009 60 / .06)`. No decorative blur or glass panels.

## Components

### Buttons

Calm 6px corners, minimum 44px primary height, 10px by 16px padding. Primary, secondary, ghost, danger and disabled variants share typography and focus. Press feedback moves by one pixel; transitions use the 180ms exponential ease in CSS. Fixture navigation is a link; real integrated actions must become buttons.

### Fields

Visible labels, native controls, meaningful help and 44px minimum height. Stronger control borders distinguish fields from decorative separators. Errors use a full border and associated text. Focus is a 3px terracotta outline with 3px offset; the search compound control highlights its wrapper on focus-within.

### Status pills

Compact, modestly rounded tinted states with readable labels. Stock, data-readiness, approval and export states are separate meanings, even when they reuse a visual primitive.

### Tables and product identity

Semantic tables, captions and column headers. Product images are small original SVGs, paired with names and SKUs. Dense tables scroll within a labeled keyboard-focusable region. Wide data does not expand the viewport. Reasoning appears in native disclosure rather than a hover-only tooltip.

### Navigation

Predictable task order: overview, inventory, reorder studio, purchase orders, suppliers and data imports. On desktop the sidebar supplies workspace context and account/settings access. On narrow layouts the same links live inside details/summary. Current page receives `aria-current` and a restrained terracotta tint.

### Signature review rail

Apricot surface, concise restock headline, sample total, clear constraint checklist, and one action. The owner approval boundary and delivery gap are explicit. It is not a chatbot and never implies automatic purchasing.

### Document

One supplier and original currency per document. Clear parties, date/terms metadata, line-item packs versus base units, item subtotal and explicit tax/shipping exclusions. Print CSS removes the shell, navigation and explanatory controls.

### Motion

Only state feedback. A skeleton uses opacity animation; reduced-motion disables animation and transitions. No orchestrated entrance, bounce, or layout-property animation.

## Do's and Don'ts

### Do

- Do preserve the 44px primary control height, native semantics, visible focus and labeled errors.
- Do keep country, language, currency and timezone independent and explicit.
- Do show unknown, stale, zero-sales and delivery-gap branches separately.
- Do keep sample data and fixture actions clearly identified until application integration replaces them.
- Do use full borders, tinted backgrounds and labeled icons for state feedback.

### Don't

- Don't build a cold enterprise dashboard or a generic SaaS card grid.
- Don't use a chatbot that obscures the purchasing decision.
- Don't imply automatic purchasing or invent real AI confidence.
- Don't substitute a marketing website for the requested application templates.
- Don't use gradient text, default glassmorphism, nested card grids, colored side-stripe borders or decorative metric heroes.
- Don't silently convert currencies, relabel historical money, or treat unknown data as zero.
- Don't ship a fixture-success link as a real save, import, approve or export action.
