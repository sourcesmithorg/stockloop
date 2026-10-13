# GCP setup for StockLoop

## 1. Status

One GCP project **was** created — `stockloop-f1a358a9` (display name **StockLoop Dev**) — because creating a project does **not** require a billing account. **No services were provisioned**: the account has **zero billing accounts**, so Cloud Run, Artifact Registry, Vertex AI, Cloud SQL and BigQuery are all unavailable for deployment. `gcloud billing projects describe stockloop-f1a358a9` returns `billingEnabled: false` and `billingAccountName: ''`. Nothing was attached, no payment details were entered, and no billable API was enabled. The project is ACTIVE and free to keep (an idle project with no billing costs $0); it can be deleted at any time with `gcloud projects delete stockloop-f1a358a9`. StockLoop remains fully developable locally without GCP — see §5.

The raw provisioning transcript is kept locally and deliberately not committed: it contains third-party account addresses from `gcloud auth list`. The redacted Phase 0 output below is the surviving evidence.

## 2. Account and project facts

| Fact | Value | Verified by |
|---|---|---|
| Active account | `perdana.rizki16@gmail.com` (the `*` entry in `gcloud auth list`) | `gcloud auth list` |
| Other credentialed accounts | 8 present in the credential store; only the one above is active | `gcloud auth list` |
| Billing accounts | **None** — `Listed 0 items.` | `gcloud billing accounts list` **and** `gcloud alpha billing accounts list` |
| New project ID | **`stockloop-f1a358a9`** (immutable — copy verbatim) | `gcloud projects describe stockloop-f1a358a9` |
| Project number | `649683220177` | same |
| Display name / labels | `StockLoop Dev` / `project=stockloop, env=dev` | same |
| Lifecycle | `ACTIVE`, created `2026-10-13T09:51:29.371Z` | same |
| Billing on project | `billingEnabled: false` | `gcloud billing projects describe stockloop-f1a358a9` |
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

Phase 0 raw output:

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

Google's own billing documentation is explicit: *"You must have a valid Cloud Billing account even if you are in your free trial period or if you only use Google Cloud resources that are covered by the Google Cloud Free Tier."* (https://cloud.google.com/billing/docs). There is therefore **no** service below that becomes usable while the account has zero billing accounts.

| Service | Needed for | Requires billing | Free-tier alternative available? |
|---|---|---|---|
| Cloud Run | Hosting frontend + backend | yes (even the always-free usage tier needs a billing account on the project) | run locally via `make`; deploy only after billing is enabled |
| Artifact Registry | Container images | yes | build images locally with Docker |
| Vertex AI (Gemini) | AI explanations | yes | deterministic rule-based explanations already work without AI |
| Cloud SQL | Managed Postgres | yes (no free tier) | local Postgres via `make db-up` on port 5433 |
| BigQuery | Optional analytics | yes (the free 1 TB/month query tier still requires a billing account) | local pandas analysis |

Notes on accuracy:

- The project ships with a set of APIs *listed* as enabled (`bigquery.googleapis.com`, `sql-component.googleapis.com`, `storage.googleapis.com`, … — see the Phase 0 block in §2). These are defaults applied at project creation. **API listed ≠ usable**: with `billingEnabled: false`, any request that would consume billable quota is rejected. No API was deliberately enabled by this bootstrap.
- `serviceusage.googleapis.com` (needed to enable other APIs) is present by default and did not require billing to exist — project creation enabled `cloudapis.googleapis.com` automatically and succeeded.
- Cloud Storage has a genuinely free 5 GB regional-storage allowance, but it too is gated behind having a billing account attached, so it is not usable today.

## 4. Manual activation checklist for the owner

Do these **only** when you decide to attach a payment method. Each step spends-or-enables-spending; stop at any point and nothing is charged.

1. Open https://console.cloud.google.com/ → pick project **`stockloop-f1a358a9`** (or search the ID).
2. Left menu → **Billing** → **Link a billing account** → add card / Google payment profile → confirm. *(This is the step the owner cannot do today.)*
   - Alternatively **Billing → Budgets & alerts → Create budget**: set project `stockloop-f1a358a9`, amount e.g. 5 USD/month, alert at 50% / 90% / 100%. **Do this before deploying anything.**
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

   *Not yet run — requires billing.*
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

   All four commands: *not yet run — require billing for the Cloud Run path they serve* (the pool/SA themselves are IAM objects; the deployment they authenticate is the billable part).
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

## 5. What a collaborator can do today with zero GCP setup

Everything needed to develop StockLoop runs locally. GCP is not on the critical path.

```bash
make template   # serves .template/ static prototype at http://localhost:4173
make env        # copies .env.example → .env
make db-up      # local Postgres via docker compose (port 5433)
make db-logs    # tail DB logs; make db-down to stop
```

Once `web/` and `api/` are scaffolded (their READMEs exist today; the code does not yet), run them locally against that `make db-up` database. No GCP account, project, or API key is required for any of this.

## 6. Cost warning

Once billing is attached, **these bill per use** — the bill starts the moment a resource exists, not when traffic arrives:

- **Cloud Run** — bills for provisioned memory/CPU while a request is processing, and (if configured) for always-on minimum instances. *First cost trigger:* `gcloud run deploy` succeeding.
- **Artifact Registry** — storage bills per GiB-month for stored images. *Trigger:* first `docker push` to the registry.
- **Cloud SQL** — bills for the instance **every second it is running**, even at zero traffic, plus disk. *Trigger:* instance creation; stop/delete when idle.
- **BigQuery** — bills per TiB scanned. *Trigger:* first query over a real table.
- **Vertex AI (Gemini) AI explanations** — **bills per input and output token**. Every user-facing "explain this" call spends money. The deterministic rule-based explanations cost nothing and are the default; enabling AI makes each explanation a metered API call.

**Configure a budget alert (step 2 of §4) before deploying anything.** With no alert, a misconfigured always-on service or a runaway loop can accrue charges unnoticed.

## 7. Unverified

- Whether `stockloop-dev` (the ID taken) belongs to a related account — not investigated; the caller has no permission to describe it.
- Free-tier byte limits (Cloud Run 180k vCPU-seconds/month, BigQuery 1 TiB/month, Cloud Storage 5 GB) are quoted from memory of Google's pricing pages, **not** re-fetched line-by-line in this session; the *gate* itself ("billing account required even for free tier") is sourced from https://cloud.google.com/billing/docs.
- The four GitHub secret names come from the task brief; no workflow file exists in the repo yet to confirm them against.
- The GitHub org/owner placeholder `<YOUR_GITHUB_ORG>` in §4 was not resolved — replace it before creating the provider, or drop the `--attribute-condition` if the repo is in a personal account.
- No API-enable attempt was made for any billable service, so whether the console would reject `run.googleapis.com` at enable time (vs. at deploy time) is untested here.
