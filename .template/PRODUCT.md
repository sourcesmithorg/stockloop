# Product

## Register

product

## Users

Owners and operators of small neighborhood retailers, frequently working at a shop counter and checking replenishment between customers. They need to see which products require attention, understand why, and decide what to purchase without becoming inventory specialists. The downstream frontend team will slice these static templates and implement the application's actual behavior.

## Product Purpose

StockLoop closes the loop from sales signals and stock data to an owner-reviewed purchase decision. The core screens support importing sales, stock, suppliers, and delivery lead times; reviewing stockout risks; examining explainable AI purchasing recommendations; editing a proposed order; and previewing supplier-specific purchase orders. Successful templates make this sequence understandable and expose realistic failure and edge states without pretending to calculate, save, import, call AI, register accounts, or send orders.

## Brand Personality

Friendly, practical, confident. The user selected this personality in the design interview. Plain language and trustworthy operational detail are more important than enterprise jargon or decorative AI theater.

## Anti-references

A cold enterprise dashboard; a generic SaaS card grid; a chatbot that obscures the purchasing decision; any interface that implies automatic purchasing or invents real AI confidence. No marketing website in place of the requested application templates.

## Design Principles

1. Lead with a clear next purchasing decision, not a wall of analytics.
2. Expose deterministic inputs and human approval separately from AI explanations.
3. Make constraints visible: budget, supplier lead time, minimum order, pack size, missing data, and stale information.
4. Provide component-friendly HTML and explicit reusable states rather than implementing business logic.
5. Design for international shop owners without imposing a market-specific currency or language.

## Accessibility & Inclusion

Target WCAG 2.2 AA patterns: labeled native controls, keyboard-visible focus, readable text, semantic tables and landmarks, reduced-motion support, and status labels that do not depend on color alone. Responsive desktop, tablet, and narrow mobile layouts are part of the template deliverable. Long product and supplier names, localized text expansion, alternate date and currency formats, and right-to-left integration considerations must be documented.

## Confirmed Locale Requirement

The user explicitly requested support for countries and their currencies, with English UI and USD as the default. Registration/onboarding must provide language and currency selection, with country and timezone context, and these choices must also be represented in settings. Static options are template material only; translation, locale inference, formatting, exchange rates, persistence, and registration behavior remain the team's responsibility.

## Deliverable Boundary

Plain static HTML templates with shared CSS and local visual assets. No React, build tool, backend, AI integration, database, authentication implementation, inventory mathematics, CSV processing, export logic, analytics service, or production deployment. Navigation between template screens and native HTML disclosure/selection controls are presentation only. Fictional sample data must be labeled as such.
