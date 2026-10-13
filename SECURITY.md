# Security Policy

## Supported Versions

StockLoop is pre-release. Only the `main` branch is supported. Backports to
earlier states are not provided; fix forward onto `main`.

## Reporting a Vulnerability

**Open a public GitHub issue** on this repository.

Issues are visible to everyone — including an attacker — the moment they
are filed, so keep the report safe and useful:

- Do not include live credentials, tokens, or personal data. A minimal
  reproduction with fictional values is enough.
- Include the affected component (e.g. an `api/` endpoint, `web/` UI, or
  deployment config), concrete reproduction steps, the impact (what an
  attacker gains or what breaks for users), and a suggested remediation if
  you have one.
- A fix may be prepared in a private fork before the issue is updated, so
  "no public fix yet" does not mean the report was ignored.

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
