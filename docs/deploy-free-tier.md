# Deploying StockLoop on free Google Cloud credit — plan and runbook

**Research date: 2026-10-13.** Every pricing, free-tier and trial term below was fetched from
Google's (or the vendor's) own pages on that date; URLs are cited inline. **Terms change —
re-check before executing anything.**

Companion document: `docs/gcp-setup.md` (verified GCP state on this account). This document
supersedes its §4 provisioning steps where they differ (notably the Artifact Registry repo
name — see step 4).

---

## 1. Bottom line

**Yes — StockLoop can be deployed on free credit, with $0 charged, if the owner confirms the
trial in the console first.** The recommended target is the existing repo project
**`stockloop-f1a358a9`** after linking the trial billing account to it in the console (one
click, same $300 credit pool — the credit lives on the billing account, not on a project).
The architecture is: **Cloud Run** (scale-to-zero, always-free monthly quota: 2M requests +
180,000 vCPU-seconds + 360,000 GiB-seconds per month, per billing account) for both the FastAPI
backend and the static Vite frontend; **Artifact Registry** (first 0.5 GB free) for images; a
**Cloud SQL 30-day free-trial PostgreSQL instance** (free for 30 days, 90-day data grace
period) for the database during the hackathon window, migrating to **Neon Free** (0.5 GB,
no card) afterwards if the project outlives the trial instance. Estimated cost at low traffic
for the first 30 days: **$0** (everything inside always-free quotas; overage would be dollars,
paid by the $300 credit anyway). The one hard gate: the free-trial account must be in good
standing with visible remaining credit — the owner must verify this in the console because
`gcloud` cannot read the billing account (verified: permission denied from this identity).
**Do NOT click "Activate" (upgrade to paid)** — trial accounts never auto-charge; they
auto-close at expiry, stopping resources instead of billing them.

## 2. Decision table

| Component | Chosen service | Why | Free-tier status | Cost at low traffic |
|---|---|---|---|---|
| Host project | **`stockloop-f1a358a9`** after linking the trial billing account (fallback: `southern-receiver-9xtlg`) | Repo docs, `deploy.yml`, and `.env.example` all target `stockloop-f1a358a9`; it is a clean-named "StockLoop Dev" project; linking billing is one console step. Credit and free-tier limits are per **billing account**, so a second linked project draws from the same $300 and the same monthly quotas ([Cloud Run pricing: "free tier usage is aggregated across projects by billing account"](https://cloud.google.com/run/pricing); [Artifact Registry pricing: "Pricing applies to billing accounts, not individual Google Cloud projects"](https://cloud.google.com/artifact-registry/pricing)). | n/a | $0 (linking is free) |
| Backend | **Cloud Run**, request-based billing, `--min-instances 0` (default), `--max-instances 2`, port 8080 | The repo's target state ([README](../../README.md)); scale-to-zero; existing `deploy.yml` already deploys it keyless | Always-free: **2M req + 180,000 vCPU-s + 360,000 GiB-s + 1 GiB NA egress /month** ([source](https://cloud.google.com/free/docs/free-cloud-features)) | $0 — a demo API serving ~10k req/mo uses ~3% of the vCPU free quota |
| Frontend (static `web/dist`) | **Second Cloud Run service** `stockloop-web` (nginx container); Firebase Hosting is the documented alternative | Reuses the same registry, WIF identity and pipeline — zero new tooling. Firebase Hosting (Spark plan: 10 GB storage + 10 GB/mo CDN transfer free, [source](https://firebase.google.com/docs/hosting/usage-quotas-pricing)) is more generous per-GB but adds a Firebase project + CLI for no current need. GCS static hosting is rejected: free HTTPS needs a billable Cloud Load Balancer (~$18/mo), and SPA URL rewriting is clumsy. | Same Cloud Run free tier applies | $0 for ~1 GB/mo egress; beyond Cloud Run's 1 GiB free egress it is ~$0.12/GB, i.e. pennies |
| Database | **Cloud SQL PostgreSQL 30-day free-trial instance** (Enterprise Plus N2, 8 vCPU/64 GB/100 GB, console-created, one per project); after 30 days: **Neon Free** | Cloud SQL has **no always-free tier** and an always-on paid instance burns credit: smallest shared `db-f1-micro` = $0.0105/hr (~$7.66/mo) + SSD ~$0.17/GB-mo ([pricing](https://cloud.google.com/sql/pricing)); a 1-vCPU dedicated instance is ~$49/mo. But the **30-day free trial instance** is free of charge for 30 days + 90-day grace where data is retained but not served ([PostgreSQL trial page](https://cloud.google.com/sql/docs/postgres/free-trial-instance)) — ideal for a hackathon demo. Neon Free (0.5 GB storage, 100 CU-h/mo, scale-to-zero after 5 min, no card, [source](https://neon.com/faqs/free-plan-limits-and-quotas)) is the $0 fallback. Supabase Free also works (500 MB) but **pauses projects after 7 days of inactivity** ([source](https://supabase.com/pricing)) — worse fit for a demo that goes quiet. | Cloud SQL trial instance: free (except public-internet data transfer, per GB); Neon: $0 forever within quota | $0 for 30 days; possible ~$0.10-class data-transfer charge for Cloud Run → Cloud SQL over public IP (see §7) |
| Container images | **Artifact Registry**, repo `stockloop`, Docker format, `us-central1` | Required by `deploy.yml` | First **0.5 GB-month free per billing account**, then ~$0.10/GiB-mo ([source](https://cloud.google.com/artifact-registry/pricing)) | $0 while total image storage stays ≤ 0.5 GB; a 300 MB image ≈ 1 tag |
| CI auth | **Workload Identity Federation** (GitHub OIDC) — keyless, no JSON keys | Already the `deploy.yml` design; matches [GitHub's OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform) and [Google's WIF pipeline doc](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) | IAM + STS free | $0 |
| AI (Gemini) | Unchanged: rule-based explanations default; Vertex via `southern-receiver-9xtlg` per `docs/gcp-setup.md` §5 | Trial credit **cannot** pay for the Gemini Developer API in AI Studio ([free-tier page, "During the Free Trial" restrictions](https://cloud.google.com/free/docs/free-cloud-features)); Vertex first-party Gemini (`gemini-2.5-flash`) is covered by trial credit and verified working | per-token, excluded from estimate | demo-scale: cents |
| Logs | Cloud Logging | 50 GiB/project/month free ([source](https://cloud.google.com/free/docs/free-cloud-features)) | free tier | $0 at demo volume |

### How the credits apply (Q1)

The $300 is preloaded **on the trial billing account**, and every project linked to that
billing account accrues costs against the same pool ([free-trial docs: "A Free Trial billing
account … accrues the Google Cloud usage costs your project generates"](https://cloud.google.com/free/docs/free-cloud-features)).
So linking `stockloop-f1a358a9` to the same billing account does **not** create a second cost
surface — there is one credit pool, one 90-day clock, one monthly free-tier quota set per
billing account. **Recommendation: link billing to `stockloop-f1a358a9` and deploy there.**
Reasoning: every repo artifact already points at it (`deploy.yml` secret target,
`.env.example` comment, `docs/gcp-setup.md`), it has a meaningful name and labels, and
`southern-receiver-9xtlg` (which currently hosts working Gemini access) stays untouched as
the AI side-channel. If the console refuses the link (permissions on the trial billing
account are unverified — see §7), fall back to deploying everything into
`southern-receiver-9xtlg` and use that ID in the `GCP_PROJECT_ID` secret.

### The no-credit-card question (Q2) — the critical one

- **Can Cloud Run be deployed on a free-trial account without a card on file?** Yes, as long
  as the project has an **active, trial billing account attached**. Cloud Run is not on the
  trial-restriction list (the restrictions are GPUs, Marketplace, quota increases, Windows
  Server VMs, VMware, crypto mining — [source](https://cloud.google.com/free/docs/free-cloud-features)),
  and "a Google Cloud billing account is required to access the Google Cloud Free Tier"
  ([same page](https://cloud.google.com/free/docs/free-cloud-features)) — a trial billing
  account satisfies this. There is no separate "payment method required" check at deploy time.
- **Is the trial already "upgraded"?** Almost certainly **not** — an upgraded account would
  show invoices and a valid payment method; a trial account shows a "Free credit" pane with
  remaining credit/days and an **Activate** button. The owner must confirm which they have
  (§3, check 2). If the Activate button is still there, the account is *not* upgraded and will
  *never* auto-charge: "Your Free Trial billing account auto-closes if you spend the $300
  credit or 90 days pass from signup and you don't upgrade to a Paid billing account"
  ([source](https://cloud.google.com/free/docs/free-cloud-features)). At expiry: billing
  disabled, resources **stopped**, then permanently deleted after a 30-day grace period. No
  bill, no card needed.
- **Tension to be aware of:** Google's signup docs say "During the sign up, you must provide
  a credit card or other payment method that is valid for the period of the Free Trial"
  ([source](https://cloud.google.com/free/docs/free-cloud-features)) — yet the owner reports
  activating the trial with no credit card. Since a billing account provably exists and is
  billing-enabled on `southern-receiver-9xtlg` (verified via `gcloud billing projects describe`),
  *something* succeeded; but whether it is a genuine trial account with $300 credit (vs. a
  differently-provisioned billing account) can only be confirmed in the console. That is
  prerequisite check #1.

## 3. Prerequisites the owner must confirm (console only — CLI cannot see any of this)

The signed-in identity gets permission denied on `gcloud billing accounts describe/list`
(verified 2026-10-13, `docs/gcp-setup.md` §2/§8), so **all** of these are console checks:

1. **Credit balance & trial type** — open <https://console.cloud.google.com/billing/overview>,
   select billing account `01191E…1DCBCB`. Confirm the page says **"Free trial account"** and
   the **"Free credit" pane** shows remaining credit and days left. Note both numbers here:
   - Remaining credit: `$________` (expect up to $300 unless a hackathon promo differs)
   - Days remaining: `________` (expect up to 90 from signup)
   - If the page says "Paid account" instead — stop and report back; the plan changes.
2. **Not upgraded** — the same page must still show an **Activate** button (that button *is*
   the upgrade). **Do not click it.** Clicking it ends the trial and enables real billing.
3. **Payment method state** — Billing → *Payment settings*: note whether a payment method is
   listed and whether it is flagged expired/invalid. An invalid method can suspend the
   billing account ([FAQ source](https://cloud.google.com/free/docs/free-cloud-features));
   a *trial* account in good standing works even so, but this is worth knowing.
4. **Budget alert exists or not** — Billing → *Budgets & alerts*. Assume none exists until the
   console says otherwise (`gcloud billing budgets list` → permission denied, verified).
5. **Cloud SQL trial instance eligibility** — open
   <https://console.cloud.google.com/sql/get-started> and check the "Experience Cloud SQL at
   no cost for 30 days" section is offered. Google requires creating it in "a new Google Cloud
   project" ([source](https://cloud.google.com/sql/docs/postgres/free-trial-instance));
   `stockloop-f1a358a9` (created 2026-10-13) should qualify — if the console refuses, use
   `southern-receiver-9xtlg` (created 2026-10-04) or a fresh project linked to the same
   billing account.

If any check fails, stop — the runbook below assumes a healthy trial.

## 4. The runbook

Every `gcloud` command passes `--project` explicitly because the local default config points
at an inaccessible project (`principal-scarab-qz266`, verified). Region is `us-central1`
throughout. **No command here spends money except the ones that create billable resources —
each is marked.** Nothing below should be run by an agent; these are owner commands.

### Step 0 — set the project locally (safe)

```bash
gcloud config set project stockloop-f1a358a9
```

Expected: `Updated property [core/project].`

### Step 1 — link billing to `stockloop-f1a358a9` (console, owner action)

Console → select project `stockloop-f1a358a9` → **Billing** → **Link a billing account** →
pick the trial account (`01191E…1DCBCB`) → confirm. Verify with:

```bash
gcloud billing projects describe stockloop-f1a358a9 --format="value(billingEnabled)"
```

Expected: `True` (previously `False` — verified 2026-10-13 in `docs/gcp-setup.md`).

Fallback: if the link fails, set `PROJECT=southern-receiver-9xtlg` everywhere below instead.
From here on the runbook uses a shell variable so both paths work:

```bash
PROJECT=stockloop-f1a358a9   # or: PROJECT=southern-receiver-9xtlg
```

### Step 2 — budget alert BEFORE deploying (console, owner action) — free

Console → **Billing** → *Cost management* → **Budgets & alerts** → **Create budget** →
**Alerts only** → scope: billing account `01191E…1DCBCB` (whole account — the CLI identity
cannot manage billing-account budgets, so the console is the path; the gcloud alternative
`gcloud billing budgets create --billing-account=… --budget-amount=5USD
--threshold-rule=percent=50 --threshold-rule=percent=90` exists but was **permission denied**
from this identity, verified 2026-10-13). Amount: **$5/month**, thresholds 50% / 90% / 100%,
recipients: the owner's email. Note: budgets are **alerts only** — they notify, they do not
cap spend; on a trial account the real cap is the credit itself (spend stops at $0).

### Step 3 — enable exactly the needed APIs (free — enablement never required billing, verified)

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sqladmin.googleapis.com \
  --project "$PROJECT"
```

Expected: no output on success (or a long-running operation notice that completes silently).
The IAM/STS/Resource Manager APIs are required by Workload Identity Federation
([source](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)).

### Step 4 — Artifact Registry repo (free until you push; **pushing starts storage metering**)

```bash
gcloud artifacts repositories create stockloop \
  --repository-format=docker \
  --location=us-central1 \
  --description "StockLoop container images" \
  --project "$PROJECT"
```

Expected: `Created [https://artifactregistry.googleapis.com/v1/projects/…/repos/stockloop].`
Verify: `gcloud artifacts repositories describe stockloop --location=us-central1 --project "$PROJECT"`.

> **Naming note:** `docs/gcp-setup.md` §4 step 4 named this repo `stockloop-repo`, but
> `.github/workflows/deploy.yml` builds and pushes to `stockloop` (workflow line:
> `repo=stockloop`). Neither existed as of 2026-10-13, so there is nothing to migrate —
> **`stockloop` is the canonical name** (it is the one the executable pipeline uses). Create
> it before the first push, or let the workflow's create-if-missing guard create it (it can
> only do so if the deploy SA has Artifact Registry admin — step 5 grants it).

### Step 5 — keyless CI identity (WIF) — IAM objects, free

```bash
# 5a. Workload identity pool + GitHub OIDC provider
gcloud iam workload-identity-pools create github-pool \
  --location=global --project "$PROJECT"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_owner=='sourcesmithorg'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project "$PROJECT"

# 5b. Deploy service account (no keys — EVER; public repo)
gcloud iam service-accounts create stockloop-deployer \
  --display-name="StockLoop GitHub Deployer" \
  --project "$PROJECT"

# 5c. Grant the deploy SA only what the pipeline uses
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:stockloop-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/run.admin" \
  --project "$PROJECT"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:stockloop-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --project "$PROJECT"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:stockloop-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project "$PROJECT"
# serviceAccountUser is needed so `gcloud run deploy` can act as the runtime
# (default Compute) service account. Tighten later by scoping it to one SA.

# 5d. Allow the GitHub repo (not any repo in the org) to use this SA
gcloud iam service-accounts add-iam-policy-binding \
  stockloop-deployer@$PROJECT.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/sourcesmithorg/stockloop" \
  --project "$PROJECT"
```

Expected outputs: pool and provider created; provider name resolves to:

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github-pool \
  --project "$PROJECT" --format="value(name)"
```

→ `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
(both project-ID and project-number forms of this string are accepted by the auth action).

**Never** run `gcloud iam service-accounts keys create`; never put a `.json` key in this
public repo or in GitHub secrets.

### Step 6 — the four GitHub secrets (free)

With the `gh` CLI authenticated as a `sourcesmithorg` admin:

```bash
gh secret set GCP_PROJECT_ID           -b "$PROJECT"                 -R sourcesmithorg/stockloop
gh secret set GCP_REGION               -b "us-central1"              -R sourcesmithorg/stockloop
gh secret set GCP_SERVICE_ACCOUNT      -b "stockloop-deployer@$PROJECT.iam.gserviceaccount.com" -R sourcesmithorg/stockloop
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER \
  -b "$(gcloud iam workload-identity-pools providers describe github-provider \
        --location=global --workload-identity-pool=github-pool \
        --project "$PROJECT" --format='value(name)')" \
  -R sourcesmithorg/stockloop
```

Manual alternative: repo **Settings → Secrets and variables → Actions**, same four names.
Expected: `✓ Set secret GCP_… for sourcesmithorg/stockloop`.

### Step 7 — database (console; **this is the one always-on resource**)

**Path A (recommended, free 30 days):** <https://console.cloud.google.com/sql/get-started>
→ "Experience Cloud SQL at no cost for 30 days" → engine **PostgreSQL**, instance ID
`stockloop-db`, region **us-central1**, set a strong password → **Create free instance**.
Expected: instance appears at Cloud SQL → Instances with a "days left on trial" banner
([details](https://cloud.google.com/sql/docs/postgres/free-trial-instance)). Note the public
IPv4 address. Connection string shape (password entered here, never committed):

```
postgresql+asyncpg://stockloop:<PASSWORD>@<PUBLIC_IP>/stockloop
```

**Path B (fallback, $0 forever, off-GCP):** create a project at <https://neon.tech>, copy the
pooler connection string, use it as `DATABASE_URL`. Free plan: 0.5 GB, compute suspends after
5 minutes idle ([limits](https://neon.com/faqs/free-plan-limits-and-quotas)). First request
after idle pays a few seconds of cold start — fine for a demo.

The `DATABASE_URL` is passed to Cloud Run at deploy time (step 8), not stored in the repo.

### Step 8 — deploy

**Backend (CI path, once `api/Dockerfile` exists):** push to `main` → the `Deploy` workflow's
`deploy` job builds `./api`, pushes `stockloop-api:<sha>` to Artifact Registry, and runs
`gcloud run deploy stockloop-api --max-instances 2 --no-allow-unauthenticated`. Expected: run
job green; service URL in the job log, e.g. `https://stockloop-api-…run.app`.

**Backend (manual path — also the first-deploy verification):**

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker build -t us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-api:latest ./api
docker push    us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-api:latest

gcloud run deploy stockloop-api \
  --image us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-api:latest \
  --region us-central1 --project "$PROJECT" \
  --port 8080 \
  --max-instances 2 \
  --min-instances 0 \
  --no-allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql+asyncpg://stockloop:<PASSWORD>@<PUBLIC_IP>/stockloop,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_REGION=us-central1"
```

Expected: `Service [stockloop-api] revision [stockloop-api-00001-…] has been deployed and is
serving 100 percent of traffic.` (Password lands in shell history — acceptable for a demo;
Secret Manager's free tier of 6 secret versions covers hardening later.)

**Frontend (once `web/Dockerfile` exists — an nginx container serving `dist/` on 8080):**
the workflow now has a `stockloop-web` deploy job gated on `web/Dockerfile` (same no-op guard
as the API). Manual equivalent:

```bash
docker build -t us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-web:latest ./web
docker push    us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-web:latest

gcloud run deploy stockloop-web \
  --image us-central1-docker.pkg.dev/"$PROJECT"/stockloop/stockloop-web:latest \
  --region us-central1 --project "$PROJECT" \
  --port 8080 --max-instances 2 --min-instances 0 \
  --allow-unauthenticated
```

Expected: `Service [stockloop-web] … deployed` with a public `*.run.app` URL.

## 5. Cost guardrails

Budget alert: **done in step 2, before any deploy.** The knobs that prevent surprises:

| Guardrail | Setting | Where |
|---|---|---|
| Scale to zero | `--min-instances 0` (Cloud Run default — never raise it on trial) | deploy flags |
| Autoscaling cap | `--max-instances 2` on **both** services | `deploy.yml` + manual commands |
| Concurrency | leave default 80 (requests share instances; keeps vCPU-seconds down) | Cloud Run default |
| Image storage | prune old tags: `gcloud artifacts docker images list us-central1-docker.pkg.dev/$PROJECT/stockloop --include-tags` → delete with `gcloud artifacts docker images delete <image> --delete-tags --quiet` when total approaches 0.5 GB | quarterly |
| Cloud SQL | the free trial instance **stops serving by itself at day 30**; if upgrading instead, the smallest paid option is ~$7.66/mo (`db-f1-micro`) — set a second budget line before doing so | console |
| Logs | 50 GiB/project/month free; add a log exclusion in Cloud Logging if debug spam appears | console |
| Upgrade button | **never click "Activate"** in Billing → Overview | human |

Estimated monthly total at demo traffic: **$0 for days 1–30** (Cloud Run inside always-free
quotas, AR under 0.5 GB, Cloud SQL trial instance free, logs free). Realistic worst cases
inside the trial: egress past Cloud Run's 1 GiB free (~$0.12/GB) and Cloud SQL public-IP
data transfer — together plausibly **<$1/month**, paid by credit. After day 30: migrate DB to
Neon → back to $0; keep Cloud SQL by upgrading → ~$9/mo from remaining credit.

## 6. Teardown (stops everything billable)

```bash
# 1. Stop serving (scale-to-zero is automatic if nothing is deleted; deleting removes URL)
gcloud run services delete stockloop-api --region us-central1 --project "$PROJECT" --quiet
gcloud run services delete stockloop-web --region us-central1 --project "$PROJECT" --quiet

# 2. Database — free-trial instance deletes immediately and irreversibly (no backups)
gcloud sql instances delete stockloop-db --project "$PROJECT" --quiet

# 3. Images (charges stop when storage empties)
gcloud artifacts repositories delete stockloop --location=us-central1 --project "$PROJECT" --quiet

# 4. CI identity
gcloud iam workload-identity-pools providers delete github-provider \
  --location=global --workload-identity-pool=github-pool --project "$PROJECT" --quiet
gcloud iam workload-identity-pools delete github-pool --location=global --project "$PROJECT" --quiet
gcloud iam service-accounts delete stockloop-deployer@$PROJECT.iam.gserviceaccount.com --project "$PROJECT" --quiet
```

Budget alert (console): Billing → Budgets & alerts → delete.
**Nuclear option:** Billing → *Linked projects* → select the project → **Detach billing
account** (or project settings → **Shut down resources**) — billing disabled on that project
means every remaining service stops; a disabled-billing project cannot incur charges
([source](https://cloud.google.com/free/docs/free-cloud-features)). Nothing here bills after
deletion; the trial credit is untouched by teardown.

## 7. Unverified — stated plainly

1. **Actual credit amount, expiry date, and trial-vs-paid status** of billing account
   `01191E…1DCBCB` — CLI permission denied (verified); console-only (prerequisite check 1).
   The "$300/90 days" in this document is the *standard* trial from Google's docs; a
   hackathon promo can differ (one 2026 hackathon offered $150 via a Devpost credit form —
   [example](https://allthingsagentichackathon.devpost.com/resources) — the owner's promo
   terms were not found).
2. **Whether the owner's trial signup was card-free.** Google's docs require "a credit card
   or other payment method" at signup; the owner says they have no credit card. A billing
   account demonstrably exists and works (Vertex verified), so *some* path succeeded, but its
   type is unconfirmed until the console check.
3. **Whether billing can be linked to `stockloop-f1a358a9` from this identity** — not
   attempted (would change cloud state). The account owner is by definition Billing Account
   Administrator of a trial account, so it should work; the fallback path (deploy into
   `southern-receiver-9xtlg`) exists precisely for this.
4. **Cloud Run deployment itself has never been executed on this account** — no
   `gcloud run deploy` has run, so the free-tier-on-trial behavior here is sourced from
   Google's documented trial terms, not from an observed deploy.
5. **Cloud SQL trial-instance eligibility** for a given project ("new Google Cloud project"
   wording, [source](https://cloud.google.com/sql/docs/postgres/free-trial-instance)) — exact
   age/newness criterion is not published; verify at the console step-7 page.
6. **Data-transfer charges on the trial instance's public IP** — Google states charges apply
   for "connections through the public internet" ([source](https://cloud.google.com/sql/docs/postgres/free-trial-instance));
   exact per-GB rate for Cloud Run→Cloud SQL same-region traffic was not verified line-by-line.
7. **Whether enabling `generativelanguage.googleapis.com` on `southern-receiver-9xtlg`
   unlocks the existing AI Studio key** (Route B in `docs/gcp-setup.md` §5) — still not
   tested; note that trial credit **cannot** pay for Gemini-API-in-AI-Studio costs in any case.
8. **`gcloud billing budgets` CLI for this identity** — `list` was permission denied
   (verified); the create path was not tested (console used instead).
9. **Promo/hackathon credits** — if the owner's credit came via a hackathon form rather than
   the standard trial, redemption timing and restrictions are unknown; check Billing →
   Overview for the credit pane before trusting the $300 figure.
