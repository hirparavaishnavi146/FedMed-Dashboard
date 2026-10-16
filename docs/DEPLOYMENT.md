# Deploying FedMed

This document covers making the FedMed dashboard publicly reachable: a Vercel-hosted
frontend calling a Render-hosted API. It states what is actually deployed, what is
deliberately left out, and what the free tiers do and do not give you.

**Nothing in this repository deploys anything by itself.** The configuration files
here are inert until you point a hosting provider at the repository and approve the
build. No hosting account, plan or setting is created by this repository.

---

## 1. What gets deployed, and what does not

| Component | Deployed? | Where |
|---|---|---|
| React dashboard (5 pages) | Yes | Vercel, static files |
| FastAPI read endpoints | Yes | Render web service |
| Security posture + audit endpoints | Yes | Render web service |
| Federated training (`POST /training/start`) | **No** | Not on the free tier — see §6 |
| 3D U-Net MRI training (`app/imaging`) | **No** | Runs locally only |
| Distributed Flower clients (`fl/`) | **No** | Runs locally only |
| Real patient data | **Never** | Not used anywhere, in any environment |

The public deployment is a **demonstration**. It is not a production medical research
deployment and it is not clinically validated.

---

## 2. Architecture

```
   Visitor's browser
          |
          |  HTTPS
          v
   +-------------------------+         +----------------------------+
   |  Vercel                 |  HTTPS  |  Render                    |
   |  static React bundle    |-------->|  uvicorn + FastAPI         |
   |  fedmed-*.vercel.app    |  CORS   |  fedmed-api.onrender.com   |
   +-------------------------+         +----------------------------+
        VITE_API_BASE_URL                  FEDMED_CORS_ORIGINS
        baked in at build time             must list the Vercel origin
```

Two things are worth stating plainly:

- **`VITE_API_BASE_URL` is compiled into the JavaScript bundle at build time.** It is
  not read at runtime. Changing it in the Vercel dashboard therefore requires a
  redeploy, not just a page refresh.
- **CORS is enforced by the browser, not the API.** If `FEDMED_CORS_ORIGINS` does not
  list the exact Vercel origin, every request is blocked client-side and the dashboard
  shows a connection error — even though `curl` against the API still works.

---

## 3. Environment variables

### Frontend (Vercel → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://fedmed-api.onrender.com` | No trailing slash. **Required.** |
| `VITE_USE_DEMO_DATA` | `false` | `false` = call the real API. `true` = render the labelled sample file and make no network calls. |
| `VITE_API_TIMEOUT_SECONDS` | `10` | Optional. |
| `VITE_API_KEY` | *leave unset* | See the warning below. |

> **Do not set `VITE_API_KEY` in a public deployment.** Every `VITE_`-prefixed value
> is compiled into the JavaScript and is readable by anyone who opens the browser's
> developer tools. It exists for local development against your own server only. The
> backend's protection depends on nobody having the key; publishing it removes that.

A production build with `VITE_USE_DEMO_DATA=false` and no `VITE_API_BASE_URL` **fails
the build on purpose** (see `vite.config.ts`). Without that check the bundle would
silently fall back to `http://127.0.0.1:8000`, which in a visitor's browser means the
visitor's own machine — surfacing as a vague "Failed to fetch" with no clear cause.

### Backend (Render → Environment)

| Variable | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.14.3` | Matches the interpreter the dependencies were resolved against. Render's own default is also 3.14.3. |
| `FEDMED_ENVIRONMENT` | `production` | |
| `FEDMED_CORS_ORIGINS` | `https://your-app.vercel.app` | Exact origin, no trailing slash. Comma-separate several. **Never `*`.** |
| `FEDMED_API_KEYS` | `ops:admin:<sha256hex>` | Empty ⇒ protected endpoints return **503**, never 200. |
| `FEDMED_SECURE_AGGREGATION_SECRET` | random string | Empty ⇒ secure aggregation stays inactive. |
| `FEDMED_AUTH_REQUIRED_FOR_READS` | `false` | `false` keeps the dashboard browsable. Mutating and admin endpoints are always protected. |
| `FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO` | `false`, or `true` for a demo | `true` lets **anyone** upload reports and run the analysis with no API key. See the warning below. |
| `FEDMED_LOG_LEVEL` | `info` | |
| `FEDMED_TLS_CERT_FILE` / `_KEY_FILE` | **leave unset** | Render terminates TLS at the edge. Setting these on Render would make uvicorn try to serve a certificate that does not exist. |

#### `FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO`

The medical-report routes normally require an API key, reads included, because they
handle real medical documents. A public demo has no way to meet that requirement: a
Vite build compiles every `VITE_` value into the JavaScript the browser downloads, so
an API key cannot be shipped to the page. Without this flag the feature is simply
unusable on a public deployment — with no keys configured the routes answer **503
`auth_not_configured`**.

Setting it to `true` removes the key requirement **for the medical-report routes
only**. Everything else keeps its requirement, which a test asserts.

What it does **not** do: it does not make uploaded reports anonymous, encrypted, or
safe to send someone's real records to. It only removes the key check. Before turning
it on:

- the deployment should serve synthetic data only;
- the page shows a prominent banner saying anyone can upload, so a visitor knows;
- every anonymous access is written to the audit log, and startup logs a warning;
- if you later need the feature to be protected, set the flag back to `false` — no
  redeploy of the frontend is needed, because the page reads the state from the API.

### Option C — one origin, pages served by the API

The two-host split above is the normal shape. When you have only one port to expose —
a tunnel, a single VM behind a reverse proxy, a container that must serve everything on
one address — the API can serve the built pages itself:

```cmd
cd frontend
npm run build            REM with VITE_USE_DEMO_DATA=false VITE_API_SAME_ORIGIN=true
cd ..\backend
set FEDMED_SERVE_FRONTEND=true
set FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO=true
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Two variables pair up and must agree:

| Side | Setting | Effect |
|---|---|---|
| Build | `VITE_API_SAME_ORIGIN=true` | Requests become relative, so they hit whatever host served the page. `vite.config.ts` allows an empty `VITE_API_BASE_URL` only when this is set, so it can never happen by accident. |
| Server | `FEDMED_SERVE_FRONTEND=true` | Serves `frontend/dist` at `/`, keeps the API routes, and returns the entry document for client-side routes so a refresh on `/medical-reports` works. |

Because both are on one origin the browser makes same-origin requests and **CORS is not
involved at all** — there is no origin to configure and nothing to get wrong.

Two details worth knowing. An unknown `/api/...` path is still an API 404, never the
HTML page, so a mistyped endpoint cannot look like a success. And with the frontend
missing, the flag logs a warning and falls back to the JSON landing response instead of
mounting something broken.

Never build this variant with `VITE_API_KEY` set. Every `VITE_` value is compiled into
the JavaScript a visitor downloads.

Generate an API key (prints the key once, then the hash to paste into `FEDMED_API_KEYS`):

```cmd
cd backend
..\.venv\Scripts\python.exe -m app.security.keys generate --label ops --role admin
```

Generate the secure-aggregation secret:

```cmd
..\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 4. Deploying the frontend (Vercel)

### Option A — import from Git in the dashboard

1. Vercel → **Add New → Project** → import the GitHub repository.
2. **Root Directory: `frontend`** — this is the setting most likely to be missed.
   The repository is a monorepo; Vercel would otherwise treat the repo root as the
   project and find no `package.json`.
3. Framework Preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
   `frontend/vercel.json` already sets these, so the defaults should match.
4. Add the environment variables from §3, including `VITE_API_BASE_URL` pointing at
   your Render URL.
5. **Deploy**, then copy the resulting URL — it is needed for `FEDMED_CORS_ORIGINS`.

> **A private repository needs the Vercel GitHub App installed on it, which only a
> repository admin can do.** If the repository belongs to someone else and it is
> private, this route is blocked. Use Option B, or fork the repo to an account you
> control and import the fork.

`vercel.json` also adds SPA rewrites (so a hard refresh on `/training` or a deep link
serves `index.html` rather than a 404) and a few security response headers.

### Option B — deploy from a local checkout with the Vercel CLI

This needs no GitHub authorization at all, because the CLI uploads the directory it
is given. It is the route used for the live demo.

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
npx vercel login
npx vercel --prod --yes --name fedmed-dashboard --build-env VITE_USE_DEMO_DATA=true
```

Two things to know before running it:

1. **The Vercel CLI does not support Node 26.** With Node 26 installed, `vercel login`
   fails with `Error: fetch failed` after printing the device code — the network is
   fine, the CLI's HTTP client is not compatible. Its own `EBADENGINE` warning states
   the supported range: Node `^20.9.0 || ^22.11.0 || ^24`. Use a supported Node for
   these commands (a portable Node 22 extracted outside the repository works, and
   avoids changing the system install).
2. **`frontend/.vercelignore` must exist, and it must list `.env*`.** `vercel deploy`
   uploads the directory and does **not** respect `.gitignore`, so without it
   `.env.local` — which holds a development API key and a `127.0.0.1` URL — is sent to
   Vercel and can end up in the bundle. Verify after deploying that no asset contains
   the key:

```cmd
curl -s https://<your-app>.vercel.app/ | grep -oE '(src|href)="[^"]+\.js"'
REM then fetch each bundle and grep it for your key. It must not appear.
```

A CLI deployment is a **snapshot**: pushing a commit does not update it. Re-run the
deploy to publish newer code, or connect the Git repository (`vercel git connect`) for
automatic deploys.

### GitHub Pages

`.github/workflows/deploy-pages.yml` publishes the dashboard to the repository's own
GitHub Pages, which needs no separate hosting account. It is inactive until an admin
sets **Settings → Pages → Source: GitHub Actions**, and it only applies to a **public**
repository: Pages on a private repository requires a paid GitHub plan. For a private
repository, use Vercel.

---

## 5. Deploying the backend (Render)

1. Render → **New → Web Service** → import the same repository.
2. Set **Root Directory: `backend`**, **Runtime: Python**.
3. Build command:
   ```
   pip install --upgrade pip && pip install -r requirements-web.txt
   ```
4. Start command:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   The import path is **`app.main:app`**. There is no `backend/app.py`; the
   application is a factory in `backend/app/main.py`. `--host 0.0.0.0` is required
   because the app's own default is `127.0.0.1`, which would be reachable only from
   inside the container, and `$PORT` is provided by Render.
5. Health check path: **`/health`**.
6. Add the environment variables from §3, with `FEDMED_CORS_ORIGINS` set to the
   Vercel URL from the previous section.
7. Deploy, then confirm:

```cmd
curl https://your-api.onrender.com/health
```

A `render.yaml` blueprint is included. If you point Render at it, review the values
first — `plan: free` and `autoDeploy: false` are deliberate: nothing should deploy
on push without a human deciding to.

### Why `requirements-web.txt`, not `requirements.txt`

`requirements.txt` installs the full stack, including **torch (511 MB)**. The API's
read paths never need it. Measured on this project:

| | |
|---|---|
| API idle, torch loaded | 340 MB |
| API peak during a federated run | 348 MB |
| `torch` on disk | 511 MB |
| also avoidable | scipy 99 MB, numpy 26 MB, monai 16 MB, nibabel 11 MB |

`requirements-web.txt` installs only fastapi, uvicorn, pydantic, pydantic-settings,
python-dotenv, python-multipart, numpy and cryptography. `monai`, `nibabel`, `scipy`,
`flwr` and `tenseal` are not imported by the API at all — only by the imaging and
distributed entry points.

For this to work, `app/federated/simulation.py` and
`app/services/federated_service.py` import the torch-backed modules **lazily**. The
modules imported are the real ones; there is no second, torch-free copy of the
federated logic that could drift from the tested one.

**Verified:** with `torch, monai, nibabel, scipy, opacus, flwr, tenseal` all blocked
from importing, `import app.main` succeeds, all eight read endpoints return **200**,
and the dashboard renders.

---

## 6. What the free tiers actually give you

| Limit | Effect on FedMed |
|---|---|
| **512 MB RAM** | Fine for the lean web service. **Not** enough to also train — see below. |
| **Spins down after ~15 min idle** | The first request after a quiet period takes several seconds while the instance wakes. Expect a slow first page load. |
| **Ephemeral filesystem** | Anything written is lost on restart or redeploy. This is why nothing important is written: the imaging experiment JSON and the audit log are in-memory or local-only. |
| **Build minutes / bandwidth** | Generous for this project. |
| **No background workers on free** | Training cannot be offloaded to a queue. |

### Training is deliberately unavailable on the deployment

`POST /api/v1/training/start` returns:

```
503  training_unavailable
"Federated training is not available in this deployment: the training dependency
 (torch) is not installed. The dashboard remains readable. Run training locally,
 or deploy the training worker with the full requirements.txt."
```

This is a **deliberate, honest refusal**, and it is checked *before* the request
configuration is validated. Reporting it as a configuration error (422) would blame
the caller for something they did not get wrong, and would surface as a message about
client counts — pointing at the wrong cause entirely.

The dashboard stays fully usable: every read page works, and
`GET /api/v1/training/config` reports `modelParameters` as **`null`** — an explicit
absence. It never reports `0`, which would read as a model with no parameters.

### To run training in the deployment instead

Install `requirements.txt` (not `requirements-web.txt`) and use **at least a 1 GB**
instance. A CPU-only run is slow and a free instance will not survive it. Running
training locally remains the recommended path.

### Recommended: keep training local

```cmd
cd backend
..\.venv\Scripts\python.exe -m app.federated.run_local --rounds 5 --clients 3 --seed 42
..\.venv\Scripts\python.exe -m app.imaging.pipeline --site HOSP-01 --epochs 4 --seed 42 --out experiments\imaging
```

Nothing needs to be uploaded anywhere for this to work, and no dataset or checkpoint
ever leaves the local machine.

---

## 7. Running locally (Windows)

```cmd
cd /d D:\FedMed-Axlero-Internship

uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt

cd frontend
npm install
```

Terminal 1 — API:

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2 — dashboard:

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
npm run dev
```

Open <http://127.0.0.1:5173>. `frontend/.env.local` (Git-ignored) selects live mode:

```
VITE_USE_DEMO_DATA=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Delete that file, or set `VITE_USE_DEMO_DATA=true`, to run on labelled sample data
with no backend required.

> `127.0.0.1`, not `localhost`. Vite can bind IPv6-only on Windows, which makes
> `http://127.0.0.1:5173` appear to be down while the server is actually running.

---

## 8. Tests and checks

```cmd
cd backend
..\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npx tsc --noEmit
npm run build
node scripts\check-api-contract.mjs
```

`check-api-contract.mjs` asserts that the frontend's expected shapes match what the
API actually returns. Run it with the API running. In a non-interactive shell, pipe
`< NUL` (cmd) or `< /dev/null` (bash) — without a TTY it otherwise fails with
`stdin is not a tty`.

---

## 9. Known limitations of this deployment

1. **Not production-secure.** No penetration test, no independent review. See
   [SECURITY.md](SECURITY.md) for the full list of 11 known risks.
2. **Not clinically validated.** The 3D U-Net is a research prototype. No metric it
   produces is a clinical result.
3. **CORS is the only access control on reads.** With
   `FEDMED_AUTH_REQUIRED_FOR_READS=false` (the default) anyone who knows the API URL
   can read the dashboard data directly, bypassing the frontend. The data is
   synthetic, so this is defensible — but it is a fact, not an oversight. Set the
   variable to `true` to require a key for reads as well.
4. **The free instance sleeps.** The first request after idle is slow.
5. **No durable storage.** The audit log is in-memory and is lost on restart.
6. **Training is unavailable in the deployment** (§6).
7. **Secure aggregation is implemented and tested but has not been exercised on a
   live multi-host run.** The API reports it as `unverified` rather than `enabled`
   for exactly that reason.
8. **Differential privacy is client-level**, not per-patient: the unit is a
   client's whole update, not one patient record.
9. **`VITE_API_BASE_URL` is public.** It is compiled into the bundle. That is
   expected for an API URL; it is why no secret may be a `VITE_` variable.

---

## 10. Updating the deployment

| Change | Action |
|---|---|
| Frontend code | Push to the deployed branch; Vercel rebuilds. |
| `VITE_API_BASE_URL` | Change in Vercel, then **redeploy** — it is baked in at build time. |
| Backend code | Push; Render rebuilds. |
| Backend env var | Change in Render → Environment; the service restarts. |
| `FEDMED_CORS_ORIGINS` | Must match the frontend origin exactly, including scheme and no trailing slash. |
| Rotating an API key | Generate a new one, update `FEDMED_API_KEYS`, restart. Old keys stop working immediately. |

---

## 11. Data handling

- No real patient data is used, in any environment. All training data is
  procedurally generated synthetic phantoms (see `docs/IMAGING.md`).
- `experiments/`, `secrets/`, `*.key`, `*.crt`, `.env` and `.env.*` are all
  Git-ignored. Verified: no dataset, checkpoint, credential or local database is
  tracked in the repository.
- The API never returns a key, a key hash, or a prefix of either. Verified against
  live responses and the audit log.
- Nothing in the deployment writes datasets, checkpoints or experiment results to
  disk, which is what makes the ephemeral filesystem a non-issue.

**This is a research prototype and a public demonstration. It is not a medical
device, has not been clinically validated, and must not be used for diagnosis or
patient care.**
