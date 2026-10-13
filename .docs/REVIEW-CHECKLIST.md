# StockLoop review checklist

Use for local-agent reviews and release readiness. The documentation checklist below is not a substitute for application/browser testing.

## Task authority

- [ ] Current owner instruction selects a bounded task and allowed write paths.
- [ ] Lane A static UI versus Lane B application scope is explicit.
- [ ] Existing repository instructions and unrelated changes are preserved.
- [ ] No roadmap/proposal is mistaken for deployment/provider/message authority.
- [ ] New requirements have source/date and accepted decision records.

## Product and visual consistency

- [ ] Cornerstore tokens and component vocabulary remain intact.
- [ ] Main hierarchy answers data trust, stock risk, reasons, cost and approval.
- [ ] No chatbot-first replacement, generic card-grid redesign or AI-confidence theater.
- [ ] Counts disclose scope and detail links open the named entity.
- [ ] SKU charts use matching SKU/window/units, not reused unrelated sales data.
- [ ] Supplier calendar assumptions are visible; quantity does not fix arrival timing.

## Contracts and safety

- [ ] Observed, derived, policy and AI data are separate.
- [ ] Unknown stock/history/cost is not zero; verified zero sales is distinct.
- [ ] Units/packs, MOQ, exact money and original currencies are correct.
- [ ] Budget shortage remains visible; no silent selection changes.
- [ ] Import policy, coverage, duplicate handling and retry semantics are accepted.
- [ ] Relevant edits create new versions and invalidate affected approvals.
- [ ] Approval/export checks run at trusted boundary with store authorization.
- [ ] Export does not imply send, supplier acceptance or purchase placement.
- [ ] AI output/schema/IDs/versions/facts are validated and fallbacks labeled.
- [ ] Untrusted imported/provider text cannot execute instructions or HTML.

## UI and inclusion

- [ ] Desktop/tablet/390/320px and text zoom have no body overflow.
- [ ] Dense table scrolling keeps identity, quantities, warnings and actions accessible.
- [ ] Native labels, landmarks, captions/headers, keyboard focus and errors survive slicing.
- [ ] Loading/empty/error/stale/offline/success states are implemented honestly.
- [ ] Saved behavior is tested by reload; failed saves retain edits.
- [ ] Locale/currency/timezone independence and historic-money preservation tested.
- [ ] German/Arabic language annotations and RTL/font fallback preserved.
- [ ] Reduced motion and forced colors tested.
- [ ] Print/export content retains identity, values, notes and required context.

## Evidence and reporting

- [ ] Applicable T-01–T-25 outcomes recorded as pass/fail/not-run.
- [ ] Domain/service/browser/manual checks distinguished.
- [ ] Current application verification is not borrowed from static baseline evidence.
- [ ] Automated accessibility pass not called WCAG certification.
- [ ] Required defects fixed and affected checks rerun before completion.
- [ ] External outcomes reconciled before retry and before success claim.
- [ ] Handoff gives exact changed paths, versions, limitations and next owner.

## Documentation-pack consistency

- [ ] Every document in README exists and local Markdown links resolve.
- [ ] AGENTS.md is canonical; agents.md points to it without conflicting policy.
- [ ] Core roadmap/backlog/feature/test/decision IDs agree.
- [ ] All 19 screen paths and all 40 state IDs match the delivered kit.
- [ ] Optional extensions remain UNCONFIRMED and outside core MVP.
- [ ] Original template files/assets are unchanged by documentation creation.
- [ ] Archive contains Markdown only; no credentials/code/binaries/internal test artifacts.
- [ ] Historical references labeled baseline, not new implementation claims.

## Severity guidance

P0: prevents the task or risks unauthorized/cross-store actions. P1: major data/approval/accessibility failure. P2: recoverable inconsistency or usability issue. P3: polish without meaningful impact. Verify findings before assigning severity; do not flood the report with speculative defects.
