# StockLoop local-agent documentation pack

Version: 1.0. Date: 13 October 2026. Deliverable: Markdown documents only.

## Start here

This pack helps a local AI coding/design agent continue from the **StockLoop Cornerstore HTML template**. It is not a second implementation or an authorization to deploy. Unzip this pack and the previously delivered HTML ZIP into neighboring folders, then give the agent the exact template path.

1. Read [AGENTS.md](AGENTS.md), [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md), and [BASELINE.md](BASELINE.md).
2. Read [DESIGN.md](DESIGN.md) and [UI-UX-GUIDE.md](UI-UX-GUIDE.md) before changing a screen.
3. Read [roadmap.md](roadmap.md). Choose a single task from [BACKLOG.md](BACKLOG.md), not the entire roadmap.
4. Load the relevant [FEATURE-SPECS.md](FEATURE-SPECS.md), [DATA-CONTRACTS.md](DATA-CONTRACTS.md), [STATE-MATRIX.md](STATE-MATRIX.md), and [ACCEPTANCE-TESTS.md](ACCEPTANCE-TESTS.md) sections.
5. Resolve only the decisions that block that task, using [DECISIONS.md](DECISIONS.md).
6. Use [AGENT-PROMPTS.md](AGENT-PROMPTS.md) to start a bounded turn. Report evidence using [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md).

## Installation without overwriting project instructions

- `AGENTS.md` is the canonical agent entry point. `agents.md` is a small compatibility pointer for tools expecting the lowercase filename. Do not maintain two divergent instruction files.
- If your repository already has `AGENTS.md`, **merge the project-specific guidance deliberately**, preserving its existing policies. Do not replace the file merely by extracting this archive.
- A safe first step is extracting the pack outside the target repository and asking the local agent to inspect it read-only.
- The pack contains no HTML, CSS, fonts, JavaScript, executable scripts, credentials, dependency manifests, or live-service configuration. The HTML template/assets are in the separate ZIP already delivered.
- All paths named `inventory.html`, `assets/styles.css`, etc. are **template-relative paths**, not files shipped in this documentation pack.
- The documents are project artifacts, not an installed AgentSkill. No special OpenClaw tools or proprietary harness are required to follow them.

## Scope labels used throughout

| Label | Meaning |
|---|---|
| CONFIRMED | Explicit user direction or a verified property of the delivered template |
| PROPOSED | Recommended implementation/policy that still needs product approval |
| OPEN | A decision the available brief does not settle |
| OPTIONAL | An idea outside the established core workflow; not MVP scope |
| VERIFIED BASELINE | A test result on the static template, not a promise about a future application |

The latest visible request asks for detailed agent guidance and a ZIP of Markdown. It says “here additional information” but supplies no additional substantive specification in the text available for this pack. An earlier assistant mentioned customer-intent, alternatives, demand capture, and supplier email. **That mention is not user confirmation.** Those ideas appear only in [OPTIONAL-EXTENSIONS.md](OPTIONAL-EXTENSIONS.md), outside the core roadmap.

## Document map

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Local-agent boundaries, reading order, task execution and completion rules |
| [agents.md](agents.md) | Lowercase filename compatibility pointer |
| [roadmap.md](roadmap.md) | Dependency-ordered milestones and release gates |
| [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) | Product problem, users, scope, success measures and non-goals |
| [BASELINE.md](BASELINE.md) | What exists, what does not, file inventory and prior verified evidence |
| [DESIGN.md](DESIGN.md) | Preserved Cornerstore tokens and visual design system |
| [UI-UX-GUIDE.md](UI-UX-GUIDE.md) | Screen composition, interaction, accessibility and responsive rules |
| [FEATURE-SPECS.md](FEATURE-SPECS.md) | Feature-by-feature behaviors, states and acceptance criteria |
| [DATA-CONTRACTS.md](DATA-CONTRACTS.md) | Framework-neutral domain objects, units, versions and invariants |
| [CALCULATION-RULES.md](CALCULATION-RULES.md) | Proposed deterministic calculation policy and fixture arithmetic |
| [AI-CONTRACT.md](AI-CONTRACT.md) | Advisory AI boundary, validation, fallback and prompt-injection handling |
| [STATE-MATRIX.md](STATE-MATRIX.md) | All 40 existing state hooks, triggers and integration expectations |
| [ACCEPTANCE-TESTS.md](ACCEPTANCE-TESTS.md) | Functional, data, UI, failure, concurrency and safety test scenarios |
| [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md) | Slicing strategy, architecture boundaries and migration away from fixtures |
| [I18N-ACCESSIBILITY.md](I18N-ACCESSIBILITY.md) | Worldwide setup, currency/date handling, RTL and accessible interaction |
| [BACKLOG.md](BACKLOG.md) | Bounded tasks with dependencies, source screens and test IDs |
| [DECISIONS.md](DECISIONS.md) | Confirmed choices, proposals and blocking policy questions |
| [OPTIONAL-EXTENSIONS.md](OPTIONAL-EXTENSIONS.md) | Unconfirmed future ideas, each with discovery and safety gates |
| [AGENT-PROMPTS.md](AGENT-PROMPTS.md) | Copyable prompts for planning, UI work, logic integration and QA |
| [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md) | Evidence-first completion/handover format |
| [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) | Cross-document consistency and release checklist |
| [PACK-VERIFICATION.md](PACK-VERIFICATION.md) | Checks performed on this documentation archive and known limitations |

The `references/` directory preserves the delivered template's original product context, confirmed brief, README, integration handoff and QA report. These are historical baseline documents. They do not authorize a future application build or replace the newer scope classification here.

## Suggested first local-agent instruction

> Read README.md, AGENTS.md, BASELINE.md and roadmap.md from this documentation pack. Inspect the separate StockLoop HTML template read-only. Identify its actual repository and existing tooling. Do not scaffold, install dependencies, edit files, call AI, send email or deploy. Return a task-specific proposal for SL-01 and name any blocking decisions. Distinguish confirmed requirements from proposed implementation choices.

## Definition of success for this pack

A local agent can identify the correct screen, understand the visual direction, select one authorized task, preserve the static reference, connect the relevant states/tests, and report exactly what was verified. It cannot use the existence of a roadmap as permission to run the whole project unattended.
