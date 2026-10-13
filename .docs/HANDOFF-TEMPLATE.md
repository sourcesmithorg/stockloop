# Task handoff template

Use this after each bounded task. Keep the primary outcome concise; include sufficient evidence for another agent to continue without reading the whole transcript.

## Required report

```text
Task ID / title:
Owner-authorized objective:
Status: complete | in progress | blocked

Outcome:
- What changed for the user.
- Static presentation versus genuinely implemented behavior.

Changed paths:
- Exact task-owned paths; unrelated work preserved.

Decisions:
- Accepted decision IDs applied.
- New proposals or unresolved policy questions.

Verification:
- Test ID / command or method / observed result.
- Browser, viewport and interaction/state checked.
- Saved/reloaded/failed/concurrent paths, if applicable.
- Evidence paths or links, with secrets/private data redacted.

Limitations:
- What was not tested or remains a fixture.
- Known defects or blocked acceptance criteria.

External actions:
- None, or exact authorized deployment/provider/send outcome.
- Do not confuse requested/queued/running with completed.

Next step:
- Remaining authorized work and its owner.
- Exact blocker and decision/access required, if blocked.
```

## Completion rules

Mark complete only when all task acceptance criteria are verified and no required in-scope work remains. A screenshot does not prove persistence; a build does not prove usable UI; AI output does not prove valid calculations; an export does not prove a supplier order.

For UI-only tasks, explicitly say controls/metrics remain fixtures and no business behavior was added. For application tasks, identify source/plan/document versions checked. For a blocked task, name one concrete missing decision/capability and what independent work was completed.

## Cross-agent context

Pass the actual repository/path, task scope, read/write boundaries, source fixtures, accepted decisions, changed paths, tests, outstanding findings and next action. Do not include credentials, raw private customer data or unrelated repository history. One task owner remains responsible for resolving review findings and delivering the result.
