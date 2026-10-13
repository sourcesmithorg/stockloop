# Bounded local-agent backlog

Status: PROPOSED work breakdown. All tasks are unstarted application/design work except source inspection performed to write this pack. Task completion requires owner authorization and actual evidence; do not check these off from documentation alone.

Priority labels: P0 foundation/safety, P1 core workflow, P2 optional quality/expansion. No sprint dates or estimates are invented.

| ID | Priority / milestone | Deliverable and source | Dependencies / decisions | Acceptance |
|---|---|---|---|---|
| SL-01 | P0 / M0 | Read-only repo/stack/instruction/baseline audit, route and fixture map | None; D-01 | All19 screens/40 states classified, no app edits; T-01/T-24 planning |
| SL-02 | P0 / M0 | Owner-confirmed scope/architecture/policy record and coherent fixture dataset | SL-01; D-01–D-04 | Confirm LaneA/B, write paths and tests; no unauthorized setup |
| SL-03 | P1 / M1 | Shell/nav/headings/primitives extracted without redesign | SL-02 | T-02/T-03/T-04/T-24 |
| SL-04 | P1 / M1 | Development state/component gallery and route identity parity | SL-03 | T-01/T-02/T-04/T-23/T-24 |
| SL-05 | P0 / M2 | Authorized auth/store membership and trusted isolation | SL-03; D-02–D-04 | T-20, expired/denied states |
| SL-06 | P1 / M2 | Regional onboarding/settings/first-run persistence | SL-05; D-12 | T-05/T-06/T-22 |
| SL-07 | P1 / M3 | Dataset schemas, file preview and column mapping | SL-06; D-05/D-06 | T-07/T-08/T-22 |
| SL-08 | P0 / M3 | Validation, commit policy, provenance and retry-safe import | SL-07; D-06–D-08 | T-08/T-09/T-10/T-21 |
| SL-09 | P1 / M3 | Supplier/catalog terms CRUD, completeness and versioning | SL-05; D-09/D-11 | T-01/T-10/T-13/T-20/T-21 |
| SL-10 | P1 / M4 | Inventory queries/risk/detail/chart from trusted inputs | SL-08/SL-09; D-09/D-10 | T-10/T-11/T-12/T-23 |
| SL-11 | P0 / M4 | Deterministic plan quantities/totals/constraints and editing | SL-10; D-10–D-12 | T-13/T-14/T-15/T-19/T-21 |
| SL-12 | P2 / M5 | Optional AI explanation adapter/validation/fallback | SL-11; D-13 | T-16/T-17; deterministic loop works without provider |
| SL-13 | P0 / M6 | Human review, permissions, immutable approval/version checks | SL-05/SL-11; D-04/D-11 | T-18/T-19/T-20/T-21 |
| SL-14 | P1 / M6 | Correct supplier/currency document and order history | SL-13; D-11 | T-01/T-14/T-18/T-25 |
| SL-15 | P0 / M6 | Export eligibility/artifact attempts/recovery and truthful status | SL-14; D-11/D-15 storage policy | T-18/T-19/T-21/T-25 |
| SL-16 | P0 / M7 | End-to-end failure/concurrency/security/browser/accessibility QA | Applicable core tasks | All applicable tests; no hidden P0/P1 |
| SL-17 | P1 / M7 | Owner usability pilot, evidence and explicitly authorized release | SL-16; D-15 | Approved release/environment/rollback; no fabricated metrics |

## Task-card template

```text
Task ID/title:
Authorization: owner instruction and scope
Objective / user outcome:
Read paths and source template:
Write paths permitted:
Out of scope:
Dependencies and decisions:
Relevant feature / state / test IDs:
Proposed steps:
Expected evidence:
External actions allowed: none unless explicitly stated
Completion criteria:
```

## Recommended slicing

SL-03 should not encompass every screen. Start with shell plus inventory/product identity and fields. SL-08 should validate one dataset end-to-end before all four schemas. SL-11 should use one supplier/currency and then add the second fixture group. SL-13 should test the approve/edit/reapprove race before export UI polish. These subdivisions remain under their parent dependencies.

## Handoff requirements

Changed paths, current task status, tests run and outcomes, screenshots, unresolved decisions and next owner. Preserve unrelated working-tree changes. A review should identify observed defects and source selectors, not generic criticism. If review finds an in-scope regression, the task owner fixes and retests it before handoff.

## Optional extension backlog

EXT-01 customer-intent UI, EXT-02 alternatives, EXT-03 unmet-demand reporting and EXT-04 supplier email are discovery proposals only. No implementation priority/dependency is assigned until D-14 is approved. See [OPTIONAL-EXTENSIONS.md](OPTIONAL-EXTENSIONS.md).
