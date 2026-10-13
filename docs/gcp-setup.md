# GCP setup for StockLoop

## 1. Status (re-verified 2026-10-13)

Two GCP projects are visible to this account and **a billing account now exists**. Every claim in this section was re-checked by running the command shown in §2. The earlier draft of this document ("zero billing accounts, no services provisioned") was true when written and is now superseded.

- **`stockloop-f1a358a9`** (display **StockLoop Dev**, project number `649683220177`) — the project this repo targets. Still **unbilled**: `gcloud billing projects describe stockloop-f1a358a9` returns `billingEnabled: false`, `billingAccountName: ''`. Cloud Run, Artifact Registry, Cloud SQL and BigQuery remain unavailable for deployment. Two AI APIs *were* successfully **enabled** on it on 2026-10-13 — `generativelanguage.googleapis.com` and `aiplatform.googleapis.com`, both confirmed by `gcloud services list --enabled --project stockloop-f1a358a9` — so API enablement provably does **not** require billing. *Calling* them still does: an authenticated Vertex AI `generateContent` request against this project returns `403 PERMISSION_DENIED` with `"reason": "BILLING_DISABLED"`. The project is ACTIVE and free to keep (an idle project with no billing costs $0); it can be deleted at any time with `gcloud projects delete stockloop-f1a358a9`. StockLoop remains fully developable locally without GCP — see §6.
- **`southern-receiver-9xtlg`** (project number `661939347981`, created `2026-10-04`, parent folder `1053048307087`) — the project the owner activated a Google Cloud trial on. **Billing is attached**: `gcloud billing projects describe southern-receiver-9xtlg` returns `billingEnabled: true` and `billingAccountName: billingAccounts/01191E…1DCBCB` (billing-account ID partially redacted). `aiplatform.googleapis.com` is enabled there; `generativelanguage.googleapis.com` is **not**. Live Gemini generation from this project is **verified working** — real `HTTP 200` responses containing generated text, both via OAuth credentials and via an API key, pasted in §5.

Still true and worth stating plainly: `gcloud billing accounts list` returns `Listed 0 items.` The signed-in identity can read the project↔billing-account *link* but cannot enumerate or describe the billing account itself (`gcloud billing accounts describe 01191E…` → permission denied, exit 1). Consequence: **trial credit balance, trial expiry date, and budget/alert state are not readable from the CLI** — they must be read from the console's Billing page (see §8).

The raw provisioning transcript is kept locally and deliberately not committed: it contains third-party account addresses from `gcloud auth list`. The redacted Phase 0 output below is the surviving evidence (a snapshot from *before* the trial was activated).

## 2. Account and project facts

| Fact | Value | Verified by |
|---|---|---|
| Active account | `perdana.rizki16@gmail.com` (the `*` entry in `gcloud auth list`) | `gcloud auth list` |
| Other credentialed accounts | 8 present in the credential store; only the one above is active | `gcloud auth list` |
| Billing accounts *listable* by this identity | **None** — `Listed 0 items.` | `gcloud billing accounts list` **and** `gcloud alpha billing accounts list` |
| Billing account linked to `southern-receiver-9xtlg` | `billingAccounts/01191E…1DCBCB` (redacted), `billingEnabled: true`. Its type (trial vs pay-as-you-go), credit balance and expiry are **not CLI-readable** — `gcloud billing accounts describe` → permission denied | `gcloud billing projects describe southern-receiver-9xtlg` |
| Project this repo targets | **`stockloop-f1a358a9`** (immutable — copy verbatim) | `gcloud projects describe stockloop-f1a358a9` |
| Project number | `649683220177` | same |
| Display name / labels | `StockLoop Dev` / `project=stockloop, env=dev` | same |
| Lifecycle | `ACTIVE`, created `2026-10-13T09:51:29.371Z` | same |
| Billing on `stockloop-f1a358a9` | `billingEnabled: false` — **unchanged by the trial** | `gcloud billing projects describe stockloop-f1a358a9` |
| AI APIs enabled on `stockloop-f1a358a9` | `generativelanguage.googleapis.com`, `aiplatform.googleapis.com` — enabled 2026-10-13, **without** billing | `gcloud services enable …`; `gcloud services list --enabled` |
| Second project | `southern-receiver-9xtlg` (number `661939347981`), created `2026-10-04`, billing **enabled**, 17 APIs enabled incl. `aiplatform.googleapis.com`, **not** incl. `generativelanguage.googleapis.com` | `gcloud projects describe`; `gcloud billing projects describe`; `gcloud services list --enabled` |
| Region choice | `us-central1` | chosen here; used by every `gcloud` command in §4 |
| Pre-existing projects | `todo-app-422613`, `work-319101` — untouched | `gcloud projects list` |

`stockloop-dev` was tried first but its ID is globally taken by someone else's project, so the unique suffix was appended:

```
$ gcloud projects describe stockloop-f1a358a9
createTime: '2026-10-13T09:51:29.371Z'
labels:
  env: dev
  project: stockloop
lifecycleState: ACTIVE
name: StockLoop Dev
projectId: stockloop-f1a358a9
projectNumber: '649683220177'
```

Phase 0 raw output (historical snapshot — it predates the trial activation, which is why `southern-receiver-9xtlg` does not appear in the project list below):

```
$ gcloud auth list
      Credentialed Accounts
ACTIVE  ACCOUNT
        <redacted-1>
        <redacted-2>
        <redacted-3>
        <redacted-4>
*       perdana.rizki16@gmail.com
        <redacted-5>
        <redacted-6>
        <redacted-7>
        <redacted-8>
# third-party account names redacted for privacy

$ gcloud config list
[core]
account = perdana.rizki16@gmail.com
disable_prompts = 1
disable_usage_reporting = True
project = principal-scarab-qz266

Your active configuration is: [default]

$ gcloud projects list
PROJECT_ID       NAME      PROJECT_NUMBER  ENVIRONMENT
todo-app-422613  todo-app  377565170069
work-319101      work      1066947198139

$ gcloud billing accounts list
Listed 0 items.

$ gcloud alpha billing accounts list 2>&1
Listed 0 items.
```

`gcloud config list` shows a stale `project = principal-scarab-qz266` that this account **cannot access** (`gcloud projects describe principal-scarab-qz266` → permission denied, exit 1). Every command in this document therefore passes `--project stockloop-f1a358a9` explicitly, or is run after `gcloud config set project stockloop-f1a358a9`.

## 3. The no-credit-card constraint and its consequences

Google's own billing documentation is explicit: *"You must have a valid Cloud Billing account even if you are in your free trial period or if you only use Google Cloud resources that are covered by the Google Cloud Free Tier."* (https://cloud.google.com/billing/docs). While an account has zero billing accounts, **no** service below becomes usable.

**2026-10-13 update:** a billing account now exists on this Google account, but it is linked only to `southern-receiver-9xtlg`. The table below still describes `stockloop-f1a358a9`, which remains unbilled — with one important exception: live Gemini calls are already possible from `southern-receiver-9xtlg` (§5), and a second, card-free route exists via the Gemini Developer API free tier (§5, Route B).

| Service | Needed for | Requires billing | Free-tier alternative available? |
|---|---|---|---|
| Cloud Run | Hosting frontend + backend | yes (even the always-free usage tier needs a billing account on the project) | run locally via `make`; deploy only after billing is linked |
| Artifact Registry | Container images | yes | build images locally with Docker |
| Vertex AI (Gemini) | AI explanations | yes — verified: `403 BILLING_DISABLED` on `stockloop-f1a358a9`, `HTTP 200` on billed `southern-receiver-9xtlg` | deterministic rule-based explanations work without AI, **or** the Gemini Developer API free tier (§5 Route B), **or** call Vertex through `southern-receiver-9xtlg` (billed per token) |
| Cloud SQL | Managed Postgres | yes (no free tier) | local Postgres via `make db-up` on port 5433 |
| BigQuery | Optional analytics | yes (the free 1 TB/month query tier still requires a billing account) | local pandas analysis |

Notes on accuracy:

- The project ships with a set of APIs *listed* as enabled (`bigquery.googleapis.com`, `sql-component.googleapis.com`, `storage.googleapis.com`, … — see the Phase 0 block in §2). These are defaults applied at project creation. **API listed ≠ usable**: with `billingEnabled: false`, any request that would consume billable quota is rejected (verified 2026-10-13: `BILLING_DISABLED` on Vertex). The only APIs this project deliberately has enabled today are `generativelanguage.googleapis.com` and `aiplatform.googleapis.com`.
- `serviceusage.googleapis.com` (needed to enable other APIs) is present by default and did not require billing to exist — project creation enabled `cloudapis.googleapis.com` automatically and succeeded. Enabling the two AI APIs on 2026-10-13 also succeeded with `billingEnabled: false`, confirming that the *enable* step is free even where *usage* is not.
- Cloud Storage has a genuinely free 5 GB regional-storage allowance, but it too is gated behind having a billing account attached on that project, so it is not usable on `stockloop-f1a358a9` today.

## 4. How this was activated / how to reproduce

Historically this section was a checklist of things the owner could not do. On 2026-10-13 a trial was activated and the AI APIs were enabled; the steps below now record **what was actually done** and what remains. Each remaining step spends-or-enables-spending; stop at any point and nothing is charged.

1. Open https://console.cloud.google.com/ → pick project **`stockloop-f1a358a9`** (or search the ID).
2. Left menu → **Billing** → **Link a billing account** → pick the account that now exists → confirm. **Not done.** A billing account is now visible on this Google account (linked to `southern-receiver-9xtlg`), so this should now be possible in the console; it was deliberately **not** attempted from the CLI because linking starts the trial-credit meter on this project and is the owner's decision.
   - **Billing → Budgets & alerts → Create budget**: set project `stockloop-f1a358a9`, amount e.g. 5 USD/month, alert at 50% / 90% / 100%. **Do this before deploying anything.** Not done — and not verifiable from the CLI (`gcloud billing budgets list` → permission denied, see §8).
3. Enable the APIs (run from any directory; the project flag is mandatory because the default config points at an inaccessible project):

   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     aiplatform.googleapis.com \
     sqladmin.googleapis.com \
     iam.googleapis.com \
     iamcredentials.googleapis.com \
     sts.googleapis.com \
     --project stockloop-f1a358a9
   ```

   **Partially run 2026-10-13:** `aiplatform.googleapis.com` and `generativelanguage.googleapis.com` were enabled successfully (no billing required for the enable step). The remaining services in the list have **not** been enabled yet.
4. Create an Artifact Registry repo for images:

   ```bash
   gcloud artifacts repositories create stockloop-repo \
     --repository-format=docker --location=us-central1 \
     --project stockloop-f1a358a9
   ```

   *Not yet run — requires billing.*
5. Create the deploy identity — **keyless OIDC only**:

   ```bash
   # Workload Identity Provider (GitHub OIDC)
   gcloud iam workload-identity-pools create "github-pool" \
     --location="global" --project="stockloop-f1a358a9"

   gcloud iam workload-identity-pools providers create-oidc "github-provider" \
     --location="global" \
     --workload-identity-pool="github-pool" \
     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository_owner=='<YOUR_GITHUB_ORG>'" \
     --issuer-url="https://token.actions.githubusercontent.com" \
     --project="stockloop-f1a358a9"

   # Deploy service account
   gcloud iam service-accounts create stockloop-deployer \
     --display-name="StockLoop GitHub Deployer" \
     --project="stockloop-f1a358a9"

   gcloud projects add-iam-policy-binding stockloop-f1a358a9 \
     --member="serviceAccount:stockloop-deployer@stockloop-f1a358a9.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   ```

   All four commands: *not yet run* (the pool/SA themselves are IAM objects; the deployment they authenticate is the billable part).
6. Populate the four GitHub secrets the deploy workflow expects:

   | Secret | Value source |
   |---|---|
   | `GCP_PROJECT_ID` | `stockloop-f1a358a9` — can be set **today** |
   | `GCP_REGION` | `us-central1` — can be set **today** |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | output of step 5 (`projects/…/locations/global/workloadIdentityPools/github-pool/providers/github-provider`) — after step 5 |
   | `GCP_SERVICE_ACCOUNT` | `stockloop-deployer@stockloop-f1a358a9.iam.gserviceaccount.com` — after step 5 |

   > **A long-lived service-account JSON key must NEVER be created or committed.** Do not run `gcloud iam service-accounts keys create`, do not add a `.json` key to this public repo, do not paste one into GitHub. Use only the short-lived OIDC token from the GitHub Actions workflow (`actions/github` → `google-github-actions/auth` with `workload_identity_provider`). No `GOOGLE_APPLICATION_CREDENTIALS` key file.
7. Deploy:

   ```bash
   gcloud run deploy stockloop-api \
     --image us-central1-docker.pkg.dev/stockloop-f1a358a9/stockloop-repo/stockloop-api:latest \
     --region us-central1 --project stockloop-f1a358a9
   ```

   *Not yet run — requires billing.* **This command is what starts costing money** (per vCPU-second / GiB-second / request beyond the free tier).

> There is currently **no** workflow file in `.github/workflows/` — the directory does not exist yet. The four secret names above are what a Cloud Run deploy workflow is expected to consume; when the workflow lands, the two settable-today secrets (`GCP_PROJECT_ID`, `GCP_REGION`) should be filled in immediately.

## 5. AI access routes (Gemini) — verified 2026-10-13

There are **two different Google products** that serve Gemini. They have different keys, endpoints, billing gates and SDK flags. Do not conflate them.

### Route A — Vertex AI (`aiplatform.googleapis.com`, "Agent Platform API")

Needs a project **with billing attached**. Works today on `southern-receiver-9xtlg`; does **not** work on `stockloop-f1a358a9`.

Verified by real calls (raw evidence, HTTP status + body):

```text
# OAuth path: Authorization: Bearer $(gcloud auth print-access-token)
POST https://us-central1-aiplatform.googleapis.com/v1/projects/southern-receiver-9xtlg/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent
HTTP 200
{"candidates":[{"content":{"role":"model","parts":[{"text":"OK"}]},"finishReason":"STOP"}],
 "usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":1,"totalTokenCount":22,
 "trafficType":"ON_DEMAND",...},"modelVersion":"gemini-2.5-flash",...}

# API-key path: header "x-goog-api-key: $GEMINI_API_KEY" (same project)
HTTP 200 — same generated text "OK", modelVersion "gemini-2.5-flash"

# Control: bogus / missing key on the same endpoint
HTTP 401 {"status":"UNAUTHENTICATED","message":"API keys are not supported by this API.
 Expected OAuth2 access token or other authentication credentials that assert a principal."}

# Same OAuth call against stockloop-f1a358a9 (billing NOT linked)
HTTP 403 {"status":"PERMISSION_DENIED","reason":"BILLING_DISABLED",
 "message":"This API method requires billing to be enabled..."}
```

Endpoint and payload details that cost debugging time (all empirical):

- Verb must be `:generateContent` with `"role"` on each content (`"role":"user"`). Omitting `role` → `400 Please use a valid role: user, model.` The legacy `:predict` / `:rawPredict` verbs → `400 FAILED_PRECONDITION` ("Gemini cannot be accessed through Vertex Predict/RawPredict API").
- Model IDs verified working: **`gemini-2.5-flash`, `gemini-2.5-flash-lite`** (HTTP 200 each). `gemini-2.0-flash`, `gemini-2.0-flash-001`, `gemini-flash-latest`, `gemini-3-pro-preview` → `404 NOT_FOUND` (not offered to this project/region).
- Cost: metered per input/output token (`trafficType: ON_DEMAND`) — see §7.

FastAPI wiring (env vars only, key material never inlined):

```python
# env: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_REGION; auth = ADC / workload identity, no JSON key file
import os
from google import genai

client = genai.Client(
    vertexai=True,
    project=os.environ["GOOGLE_CLOUD_PROJECT"],          # southern-receiver-9xtlg today
    location=os.environ.get("GOOGLE_CLOUD_REGION", "us-central1"),
)
resp = client.models.generate_content(model="gemini-2.5-flash", contents="...")
```

Use `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_REGION`; SDK is `google-genai` with `vertexai=True` (`google-cloud-aiplatform` also works). Authentication is ADC/OIDC — never a service-account JSON key (see the §4 warning).

### Route B — Gemini Developer API / AI Studio (`generativelanguage.googleapis.com`)

The route that requires **no credit card**: keys are created in Google AI Studio (`aistudio.google.com`) and used against `generativelanguage.googleapis.com` with `?key=$GEMINI_API_KEY` or header `x-goog-api-key`. The owner reports the AI Studio free tier is roughly **15 requests/minute and 1M tokens/minute** — owner-reported, not re-verified here (§8). Env var name: **`GEMINI_API_KEY`**.

Current blocker, verified by execution 2026-10-13: an existing AI-Studio-format key (prefix `AQ.`, consumer project `southern-receiver-9xtlg`) is **rejected** by the Developer API:

```text
GET https://generativelanguage.googleapis.com/v1beta/models   (header x-goog-api-key)
HTTP 403 {"reason":"SERVICE_DISABLED",
 "message":"Gemini API has not been used in project 661939347981 before or it is disabled.
 Enable it by visiting https://console.developers.google.com/apis/api/
 generativelanguage.googleapis.com/overview?project=661939347981 then retry."}
```

`gcloud services list --enabled --project southern-receiver-9xtlg` confirms `generativelanguage.googleapis.com` is absent. A bogus key on the same endpoint returns `400 API_KEY_INVALID`, so the rejection is *service-disabled*, not *bad key*. The fix is one owner action (either of):

```bash
gcloud services enable generativelanguage.googleapis.com --project southern-receiver-9xtlg
# or click the activationUrl from the error body
```

Once enabled, the same key should reach the Developer API free tier — **not yet re-tested** (§8). A key created fresh in AI Studio while that project is selected may behave the same way unless AI Studio enables the service implicitly — also untested.

Same SDK, only the flag changes:

```python
# env: GEMINI_API_KEY; read from env, never inlined, never committed
import os
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
resp = client.models.generate_content(model="gemini-2.5-flash", contents="...")
```

### Which route when

| | Route A — Vertex AI | Route B — AI Studio |
|---|---|---|
| Works today? | **Yes** (billed `southern-receiver-9xtlg`), verified 200 | **No** for the existing key (service disabled); fix is one `gcloud services enable` |
| Needs billing? | yes | no (free tier, no card — owner-reported limits) |
| Auth | ADC / workload identity (`GOOGLE_CLOUD_PROJECT` etc.) | API key (`GEMINI_API_KEY`) |
| Rate limits | billed per token, project quotas | ~15 req/min free tier (owner-reported) |
| Use for | production explanations once billing is linked, or today against the trial project | local/dev explanations, CI, the adapter's fallback-free path |

Rule-based explanations remain the zero-cost default regardless of route.

## 6. What a collaborator can do today with zero GCP setup

Everything needed to develop StockLoop runs locally. GCP is not on the critical path.

```bash
make template   # serves .template/ static prototype at http://localhost:4173
make env        # copies .env.example → .env
make db-up      # local Postgres via docker compose (port 5433)
make db-logs    # tail DB logs; make db-down to stop
```

Once `web/` and `api/` are scaffolded (their READMEs exist today; the code does not yet), run them locally against that `make db-up` database. No GCP account, project, or API key is required for any of this.

## 7. Cost warning

Once billing is attached, **these bill per use** — the bill starts the moment a resource exists, not when traffic arrives:

- **Cloud Run** — bills for provisioned memory/CPU while a request is processing, and (if configured) for always-on minimum instances. *First cost trigger:* `gcloud run deploy` succeeding.
- **Artifact Registry** — storage bills per GiB-month for stored images. *Trigger:* first `docker push` to the registry.
- **Cloud SQL** — bills for the instance **every second it is running**, even at zero traffic, plus disk. *Trigger:* instance creation; stop/delete when idle.
- **BigQuery** — bills per TiB scanned. *Trigger:* first query over a real table.
- **Vertex AI (Gemini) AI explanations** — **bills per input and output token**. Every user-facing "explain this" call spends money (`trafficType: ON_DEMAND` was returned by the verified 2026-10-13 call). The deterministic rule-based explanations cost nothing and are the default; enabling AI makes each explanation a metered API call. Route B (§5) instead spends free-tier *quota*, not money.

**Configure a budget alert (step 2 of §4) before deploying anything.** With no alert, a misconfigured always-on service or a runaway loop can accrue charges unnoticed. No budget could be found from the CLI — see §8 — so assume none exists until the console says otherwise.

## 8. Unverified

- **Trial credit balance and expiry** on billing account `01191E…1DCBCB` — `gcloud billing accounts describe` and the equivalent REST call both return permission denied for this identity; `gcloud billing accounts list` shows nothing. Only the console's Billing page can answer this. Likewise whether the promotion ("Hack2skill" hackathon credits) applied, and how much credit remains.
- **Budget/alert state** — `gcloud billing budgets list --billing-account=…` → permission denied (caller lacks `serviceusage.services.use` context on the project it tried). Treat as "no budget configured" until checked in the console.
- Whether **Route B starts working** the moment `generativelanguage.googleapis.com` is enabled on `southern-receiver-9xtlg` — the enable command was deliberately not run (owner's action), so the key has not been re-tested against the Developer API after enablement.
- Whether the trial can be **linked to `stockloop-f1a358a9`** from the CLI/console, and what it would consume — not attempted; it is the owner's decision (step 2 of §4).
- AI Studio free-tier limits (~15 req/min, 1M tokens/min) are the **owner's figure**, not fetched from Google's quota docs in this session.
- Whether `stockloop-dev` (the ID taken) belongs to a related account — not investigated; the caller has no permission to describe it.
- Free-tier byte limits (Cloud Run 180k vCPU-seconds/month, BigQuery 1 TiB/month, Cloud Storage 5 GB) are quoted from memory of Google's pricing pages, **not** re-fetched line-by-line; the *gate* itself ("billing account required even for free tier") is sourced from https://cloud.google.com/billing/docs.
- The four GitHub secret names come from the task brief; no workflow file exists in the repo yet to confirm them against.
- The GitHub org/owner placeholder `<YOUR_GITHUB_ORG>` in §4 was not resolved — replace it before creating the provider, or drop the `--attribute-condition` if the repo is in a personal account.
- Whether the remaining services in the §4 step-3 enable command would succeed the same way the two AI APIs did (they should — enablement proved billing-free — but only the AI pair was actually run).
