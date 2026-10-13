# StockLoop UI/UX implementation guide

Read [DESIGN.md](DESIGN.md) for canonical visual tokens. This guide turns that system into screen behavior. It does not authorize new flows or claim business logic exists.

## Experience hierarchy

The owner should answer five questions in order: **Is my data trustworthy? What needs stock? Why? What will it cost? What exactly am I approving?** Freshness and blockers are operational content, not footnotes. A chart is secondary to a decision table and cannot contradict its inputs.

Use familiar product UI. Keep navigation quiet and predictable. Avoid a conversational AI interface that hides constraint checks. Explanations disclose inline; do not require hover. Start with a clear overview and progressively reveal detail.

## Shell and navigation

Desktop uses the established 224px task sidebar. Narrow layouts use accessible expandable navigation and one-column content. Preserve workspace identity, selected navigation, store/account context, skip link and one main landmark. On a routed app, route changes need meaningful titles and deliberate focus placement; do not leave focus stranded in a removed menu.

Navigation sequence: overview, inventory, reorder studio, purchase orders, suppliers, data imports. Settings is secondary. First-run readiness precedes fake dashboard metrics. Component/state galleries are development-only.

## Screen composition contracts

| Screen family | Primary question | Main content | Supporting content | Primary action |
|---|---|---|---|---|
| Overview | What should I review now? | Scoped restock suggestions and priority table | Freshness, budget, activity, store-wide sales | Review restock plan |
| Inventory | Which SKU is affected? | Identity, stock, demand, cover, lead time and state | Search/filter, pagination, provenance | Inspect selected product |
| Product | Why is this risky? | Inputs and depletion/delivery timeline | Supplier terms, explanation and SKU-scale history | Review reorder |
| Reorder | What do I want to buy? | Editable line quantities and supplier groups | Apricot totals/constraint rail, policy input | Review eligible proposal |
| Orders | Which exact version/document? | Correct ID, supplier, currency and state | Export history and source version | Open matching document |
| Supplier | Are these terms complete? | Contact, currency, packs/MOQ, lead time/calendar | Products and last verified details | Save reviewed terms |
| Imports | Is the input usable? | Readiness and step content | Sources, schema/format help, row issues | Continue only when valid |
| Auth/setup | Can I enter and configure my store? | Short labeled form | Honest recovery/help and region choices | Submit/save when implemented |
| Settings | What changes and what stays historical? | Clearly grouped preferences/policy | Unsaved state and change impact | Save validated preferences |

One visually dominant action per decision area. Supporting actions remain secondary. A disabled action explains its blocker beside the control. Never hide that reason solely in a tooltip.

## Shared component behavior

- **Buttons:** real mutations are buttons; navigation is a link. Include default, hover, focus, active, disabled, loading, error and success. Prevent duplicate mutation attempts while retaining an accessible pending label.
- **Fields:** visible labels, units/currency context, help/error associations. Do not use placeholders as labels. Show field errors and an error summary for long forms. Keep input after recoverable failure.
- **Pills:** state text and optional consistent icon. Inventory risk, data readiness, approval and export are distinct enums; do not merge them into one ambiguous “good/bad” state.
- **Tables:** semantic captions, scoped headers, numeric alignment, persistent SKU identity. Scrolling stays inside the labeled keyboard-focusable region. Narrow screens must retain quantity/currency/blocker/action access.
- **Reasoning:** visible input provenance and source label (“Rule-based explanation” or “AI-assisted explanation”). Expanded content must remain accessible on touch and keyboard.
- **Review rail:** summarize eligible/excluded lines, per-currency total, budget, unresolved constraints and review status. Do not show a global total across incompatible currencies.
- **Feedback:** inline error for affected action; global notice only for genuine global effects. Live announcements should report meaningful changes without reading the entire table after every edit.
- **Documents:** commercial identity, units/packs, original currency, subtotal and excluded tax/shipping. Approval/export version is explicit. Browser print must hide shell controls and retain disclaimers appropriate to demo mode.

## Interaction specifications

### Search/filter/pagination

Distinguish no data from no matches. Show filter count and clear-all. Retain keyboard focus when results refresh. Announce result count politely. Avoid automatic routing caused by selecting a filter. Persist filters only under an approved UX contract; do not assume permanent settings.

### Quantity edits

Label base units, step/pack size and MOQ. Show original suggestion and owner edit where needed. Recalculate totals/constraints using trusted policy, mark pending calculation and invalidate affected prior approval. Do not show updated units with an old trusted total. On failure keep the input but block approval and show that calculation is unresolved.

### Import corrections

Show row number, column, bad value, expected format, severity and correction instruction. Redact overly long or sensitive values. Imported filenames and values are escaped data. Mapping errors prevent continuation. Warnings are not silent errors; excluded rows must be counted.

### Approval

A review action should state exact supplier/currency groups, quantities, cost treatment, warnings and version. Partial approval is deliberate, not a silent omission. Confirmation, if required by policy, is a concise review step, not a generic “Are you sure?” modal.

### Save/exit/conflict

Use a clear saved/dirty/saving/error state. Preserve edits after server failure. On conflicting versions, offer compare/reload/reapply, not silent overwrite. Warn before abandoning edits only when actual dirty state exists. Never fake a save with a success-state anchor.

## Responsive acceptance targets

Recheck 1440, 768, 390 and 320 CSS pixels plus 200% text zoom. These are test sizes, not a demand to introduce four arbitrary new breakpoints. Respect existing responsive rules before altering them. Text wraps, controls remain usable, tables scroll locally, and no body-level horizontal overflow appears. Long supplier names and translations should wrap without hiding identity.

The reference uses compact metadata. When creating real mobile interaction, favor readable 14px-or-larger operational text and 44px touch targets; audit dense exceptions rather than indiscriminately enlarging everything. Form inputs need legible sizing on target mobile browsers. Keep primary totals visible without sticky overlays obscuring warnings/actions.

## Accessibility acceptance

One h1/main, meaningful title, skip link, all labels, accurate `aria-current`, keyboard-operable disclosure, no traps, visible focus, text status and real disabled semantics. Preserve German `lang="de"` and Arabic `lang="ar" dir="rtl"` examples. Icons decorative beside text use `aria-hidden`; meaningful standalone controls need names.

After real asynchronous behavior is added, use status/error announcements intentionally. Test screen reader and keyboard in the implemented stack. Automated axe detection is a useful signal, not conformance certification. See [I18N-ACCESSIBILITY.md](I18N-ACCESSIBILITY.md).

## UI copy rules

Friendly, practical, confident. Prefer “Review draft,” “Missing unit cost,” “Export ready” and “Delivery timing unconfirmed.” Avoid “AI guarantees,” “100% confidence,” “order placed” for file generation, and vague “Something went wrong” without recovery. Counts always disclose scope: four restock suggestions is not all products needing attention.

## Definition of UI done

A faithful default screen plus required states, real identity links, correct data hierarchy, usable mobile composition, keyboard checks and browser screenshots. If logic is out of scope, label fixtures and report that explicitly. Do not claim saved/imported/approved outcomes from presentation-only interactions.
