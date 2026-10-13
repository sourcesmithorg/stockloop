# Security Policy

## Supported Versions

StockLoop is pre-release. Only the `main` branch is supported. Backports to
earlier states are not provided; fix forward onto `main`.

## Reporting a Vulnerability

**Do not open a public issue.**

Email [perdana.rizki16@gmail.com](mailto:perdana.rizki16@gmail.com) privately.
We target acknowledgement within **48 hours**. The timeline for a fix will be
agreed with you — we will not unilaterally decide your report is low priority.

Please include:

- Affected component (e.g. `api/` endpoint, `web/` UI, deployment config).
- Reproduction steps — concrete enough to act on.
- Impact — what an attacker gains or what breaks for users.
- Suggested remediation, if you have one.

## Scope

StockLoop handles stock, sales, supplier, and cost data. The following are in
scope:

- **Store-scoped authorization.** Every read and write must be scoped to the
  store the caller belongs to. Cross-store data exposure of any kind is a
  genuine vulnerability.
- **Approval boundaries.** An unauthorized party being able to approve a
  purchase proposal is a vulnerability.
- **Export boundaries.** An unauthorized party being able to export a purchase
  order is a vulnerability.
- **Prompt injection against the advisory AI layer.** The Gemini-on-Vertex AI
  layer reads data that a supplier or upstream source may control; injection
  against it is in scope.

## A note on the AI layer

The AI layer is **advisory**. It is never authorization. "The model approved
it" is never a valid design or an acceptable explanation in a security review.
Human approval is a hard boundary, not a suggestion that language influences.
