# FedMed-Axlero-Internship
Privacy-Preserving Federated Learning for Medical Image Segmentation

## Objective

Train a 3D U-Net MRI segmentation model across three simulated hospital clients,
aggregate the updates with Federated Averaging (FedAvg), and add privacy mechanisms —
without any raw patient scan ever leaving its node.

## Planned stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite, Recharts |
| Backend API | Python, FastAPI |
| Modelling | PyTorch, MONAI (3D U-Net) |
| Federated learning | Flower, FedAvg, gRPC |
| Privacy | TenSEAL (homomorphic encryption), differential privacy |
| Tests | pytest |

## Repository layout

```
backend/app     FastAPI application (config, schemas, services, api/v1 routes)
backend/tests   pytest suite
frontend        React + TypeScript + Vite dashboard
fl              Flower server and client nodes (milestone M4)
ml              model, training loop, data generation (milestone M2-M3)
docs            API reference and design notes
data            local data (Git-ignored, never committed)
```

## Constraints on this machine

- **CPU-only training.** No NVIDIA GPU (Intel HD 630 integrated, ~8 GB RAM), so the
  3D U-Net is kept deliberately small: 64³–96³ patches, batch size 1–2, few base channels.
- **Python 3.14.7.** All pinned versions in `requirements.txt` were resolved and verified
  for Python 3.14 / Windows x64.

## Setup (Windows, Command Prompt)

Create the virtual environment and install dependencies once:

```cmd
cd /d D:\FedMed-Axlero-Internship
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt
```

Always call Python as `.venv\Scripts\python.exe` and install with
`.venv\Scripts\python.exe -m pip`. A bare `pip install` on this machine targets Hermes's
private virtual environment, not this project.

### Run the backend

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API at <http://127.0.0.1:8000>, interactive docs at <http://127.0.0.1:8000/docs>.
See [docs/API.md](docs/API.md) for every endpoint and real example responses.

### Run the backend tests

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m pytest
```

### Run the frontend

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
npm install
npm run dev
```

Open <http://localhost:5173>. See [frontend/README.md](frontend/README.md).

By default the frontend renders clearly labelled sample data and makes no network
calls. To make it read the live API, create `frontend/.env` with:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_DEMO_DATA=false
```

### Check that the two halves agree

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
node scripts/check-api-contract.mjs
```

## Data policy

- **No real patient data.** Synthetic phantom volumes only, until an approved
  public research dataset is added.
- No secrets, keys or tokens in the repository; local settings go in `.env`
  (Git-ignored, copy it from `.env.example`).

## Status

- **M0 complete** — repository skeleton, dependency pins, ignore rules.
- **Stage 1 complete** — React + TypeScript + Vite dashboard, five pages, verified.
- **Stage 2 complete** — FastAPI backend, 80 passing tests, frontend wired to the
  live API and checked against it.
- **Stage 3 complete** — cross-silo federated learning: a Flower server and three
  simulated hospital clients, this project's own sample-count-weighted FedAvg,
  round history and measurements on the dashboard. See
  [docs/FEDERATED.md](docs/FEDERATED.md).
- **Stage 4 complete** — medical-imaging model: a configurable 3D U-Net, MONAI
  preprocessing (orientation, spacing, intensity, resize), a reproducible training
  loop with checkpoints, and Dice/IoU metrics computed from actual predictions.
  See [docs/IMAGING.md](docs/IMAGING.md).
- **Stage 5 complete** — privacy and security: API-key authentication with scoped
  authorization, TLS support, a real secure-aggregation masking implementation, a
  working differential-privacy accountant, and a real (redacting) audit log. See
  [docs/SECURITY.md](docs/SECURITY.md).
- **Stage 6 complete** — public deployment configuration: a Vercel frontend and a
  Render API, with the API's read paths decoupled from the machine-learning stack so
  the dashboard runs on a small instance. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
  **Nothing is deployed by this repository**; the configuration is inert until you
  point a hosting provider at it and approve the build.

### Deploying

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short: import the monorepo into
Vercel with root directory `frontend`, and into Render with root directory `backend`
using `requirements-web.txt` and the start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `FEDMED_CORS_ORIGINS` to the
deployed frontend origin and `VITE_API_BASE_URL` to the deployed API URL.

Federated training is **not available** on the free hosting tier and returns an
honest `503 training_unavailable`; the dashboard stays fully readable, and
`modelParameters` reports `null` rather than a misleading `0`. Training runs locally,
where no dataset or checkpoint leaves the machine.

Not built yet, and not claimed anywhere: homomorphic encryption, any real
cross-silo deployment across separate hospital networks, durable audit storage, and
any patient data.

**This application is not production-secure.** It has not been penetration tested or
independently reviewed. Differential privacy and secure aggregation are implemented
and covered by tests but have not been exercised on a live run. The 3D U-Net is a
**research prototype**: not a medical device, not clinically validated, and no metric
it produces is a clinical result. Its default training data is procedurally generated
synthetic phantoms.

### Datasets — preparing MRI data and training

The dashboard has a **Datasets** page for the real MRI workflow: validate approved
research data, assign it to a simulated hospital client, and train the 3D U-Net on it.

**Expected folder structure.** One folder per dataset:

```
dataset_folder/
  case_001.nii.gz        <- the image volume
  case_001_seg.nii.gz    <- its mask, same name plus _seg
  case_002.nii.gz
  case_002_seg.nii.gz
```

**Accepted formats:** NIfTI only, `.nii.gz` or `.nii`. Each case must be a single 3D
volume; a 4D series must be split into separate volumes first.

**Refused on purpose** — not interchangeable with 3D MRI volumes: DICOM (`.dcm`),
NRRD, MetaImage, NIfTI-2, 2D images (`.png`, `.jpg` — an X-ray is not a volume), and
`.pdf` reports. Each is rejected by name, with the reason.

**What validation checks**, before any preprocessing runs:

| Check | Behaviour |
|---|---|
| Image and mask on the same voxel grid | **Rejected** if shape or voxel size differ |
| Mask values | **Rejected** unless binary (0 and 1) |
| Missing mask for a case | Rejected, naming the expected filename |
| Mask with no matching image | Rejected as an orphan |
| Axis below 8 or above 1024 voxels | Rejected |
| 4D volume | Rejected, with the shape it found |
| Empty or nearly-full mask | Warning only |

The geometry checks matter: the MONAI pipeline resizes image and mask *independently*,
so a mask on a different grid would otherwise resize successfully and train on a
spatially meaningless target. Validation therefore runs on the raw file headers.

Uploads are processed **on the same server**, held in a temporary staging directory that
is swept by age, deleted when the dataset is removed, and never sent anywhere else. A
server-side directory is only read — never modified or deleted. Limits: 512 MB per file,
2 GB per dataset, 500 cases.

**Training.** Validate, assign to a hospital client, then press Start training. It runs
the real 3D U-Net and reports the loss and Dice the loop measured — never a simulated
success. Checkpoints and `experiment.json` go to `backend/experiments/imaging/`, which is
Git-ignored and not served by the API.

> **Training does not run on the free hosting tier.** A run needs ~384 MB with torch
> loaded and the free tier has 512 MB in total, so the API and training cannot share one
> instance. The deployed dashboard reports `training_unavailable` and stays readable. To
> surface a local run's real numbers publicly, point `FEDMED_IMAGING_EXPERIMENT` at the
> `experiment.json` it produces.

```cmd
cd /d D:\FedMed-Axlero-Internship\backend

REM Validate and train from the command line, without the dashboard
..\.venv\Scripts\python.exe -m app.imaging.pipeline --data-dir D:\datasets\mri-seg --epochs 4 --seed 42
```

**Data handling.** Use synthetic phantoms or approved, appropriately de-identified
research data. Never upload identifiable patient data. No real patient data is used
anywhere in this project, and no dataset or checkpoint is committed to Git.

### Case Intake — sending mixed files and getting an honest summary

The **Case Intake** page takes one case as any mix of files and reports what each one
is and what could genuinely be done with it.

**What it does, per input type:**

| You send | What happens |
|---|---|
| **MRI volume** (`.nii`, `.nii.gz`) | Validated (geometry, shape, label values) and segmented by the real 3D U-Net when a checkpoint exists. Dice is measured against your mask if you supply one. |
| **Report** (`.pdf`, `.txt`, `.md`) | Text is **quoted verbatim** under the headings the document itself uses (Findings, Impression, …). A scanned PDF has no text layer; that is reported as *unreadable*, not as *empty*. |
| **2D image** (`.png`, `.jpg`, …) | Dimensions, colour mode and format are reported. **Never analysed.** |
| **DICOM** | Refused by name, with the reason. Convert to NIfTI first. |
| **Anything else** | Reported as unrecognised. Nothing is assumed. |

Files are identified by their **content** (magic bytes), not their extension, so a PDF
saved as `.dcm` is still treated as a PDF.

> **This does not diagnose anything, and no "suggestion" is produced.** No component of
> this project can read a 2D X-ray or a written report, and its only model was trained
> on procedurally generated synthetic phantoms. A clinical suggestion generated from
> these inputs would be invented, so instead of manufacturing one, every response
> carries `interpretationSupported: false` together with the reason. The page shows
> "NOT A DIAGNOSIS" as its badge.

Uploads are processed on this server, held in a temporary staging directory that is
swept by age, and are never sent anywhere else. Deleting a case deletes its staged
files. Never upload identifiable patient data.

```cmd
REM Send a case from the command line
curl -X POST http://127.0.0.1:8000/api/v1/cases/intake ^
  -H "X-API-Key: <your-key>" ^
  -F "files=@D:\cases\case-001\volume.nii.gz" ^
  -F "files=@D:\cases\case-001\report.pdf" ^
  -F "files=@D:\cases\case-001\xray.png"
```

### Medical Report Analysis — uploading reports and getting a decision-support draft

Upload one to three reports for one patient. The app extracts the facts from them,
compares them, and produces a structured draft to help you prepare for a consultation.
**It does not diagnose and it does not replace a doctor.** The page says so, and the
API enforces the parts it can.

What it will and will not do:

- It extracts values, dates, diagnoses and printed reference ranges, and cites the
  report and page each one came from.
- It calls a value abnormal **only** if that value's own report printed a reference
  range that it falls outside. A number printed with no range is never judged.
- It scans the text for explicit warning terms and, if it finds any, raises the
  urgency and shows the emergency notice **before** the rest of the analysis.
- The narrative summary, possible complications and clinical suggestions come from an
  optional AI provider. **Without one configured, those sections say they are
  unavailable.** No placeholder analysis is invented to fill them.
- It never presents a possibility as a diagnosis, and never suggests a medication or
  dose change.

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then, in the app: **Medical Report Analysis** in the sidebar.

1. **Create a session.** One is created for you when you upload your first file.
2. **Upload one to three reports.** Drag a file onto a slot or press *Choose a
   report*. PDF, text, PNG and JPEG are accepted; each file is checked and a rejected
   file tells you why. Text is extracted on upload, and OCR is used only for scans
   with no embedded text.
3. **Check the extracted information.** The *Extracted information* tab shows each
   filename, type, status, page count, the extracted text, and what was parsed out of
   it. Verify values against the original before trusting anything downstream.
4. **Confirm the reports belong to the same patient.** This is a required checkbox,
   not a warning. Comparing reports from different people is meaningless, so the API
   refuses with `422 same_patient_not_confirmed` until it is ticked.
5. **Press *Compare reports*.** You get what is consistent across reports, what
   differs (with the change), what appears in only one report, and what is missing.
6. **Press *Analyse reports*.** Sections A–G are produced. Measured findings are
   separated from AI-generated prose, and every finding cites its source report and
   page.
7. **Print or save.** *Print* and *Save as PDF* both open the browser's print dialog
   — choose "Save as PDF" as the destination to get a file. The page does not generate
   a PDF itself, and the buttons say so.
8. **Discard the session** when you are done. This deletes the staged files as well as
   the session.

To enable the generated sections, set `FEDMED_AI_BASE_URL`, `FEDMED_AI_API_KEY` and
`FEDMED_AI_MODEL` (see `backend/.env.example`) and restart the backend. Any
OpenAI-compatible endpoint works. With a provider configured the extracted report text
is sent to it — read the privacy note in `.env.example` first, and keep the key
server-side; it is never sent to the browser.

Two limitations worth stating plainly. **Every medical-report endpoint requires an API
key, reads included**, because it handles real medical documents — so on a public
deployment you need a key to use this page at all, and a key must never be put in
frontend code. And **this feature is separate from the federated MRI pipeline**: the
federated model segments MRI volumes, and it cannot interpret a report or an X-ray.
Nothing here should be read as claiming otherwise.

## Contributor

Vaishnavi Hirpara
