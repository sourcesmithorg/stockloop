# Code ownership

This repository deliberately has **no `.github/CODEOWNERS` file**.

## Why

Ownership here is organization-level, not individual-level. GitHub's
CODEOWNERS parser accepts exactly two owner forms:

- a user handle: `@someuser`
- an organization team: `@org/team-name`

A bare organization handle (`@sourcesmithorg`) is **not valid**. GitHub
accepts the file without error but silently ignores such an entry — it
matches nobody and enforces nothing. This repo once shipped a CODEOWNERS
that said `@sourcesmithorg` everywhere; it looked like enforcement while
providing none. Rewriting it to an individual handle would restore real
enforcement but re-introduce personal ownership, which is not wanted
either.

## How ownership is actually enforced

Organization-scope ownership is enforced through **branch protection
rules on `main`** configured in repository settings (Rules → Branch
protection rules), requiring:

- the **CI**, **Quality**, and **Gitleaks** checks to pass, and
- review approval before merge.

Until branch protection is configured, no individual is named as a code
owner. When the organization grows teams, an org-team CODEOWNERS
(`@sourcesmithorg/<team-name>`) can be introduced — that is the only
org-shaped form GitHub honors.
