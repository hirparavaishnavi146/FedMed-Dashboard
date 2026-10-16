# Hugging Face Space — deployment files

These two files configure a Hugging Face Space that runs the **web tier** of FedMed:
the FastAPI app serving its own built frontend on one origin.

Why a Space rather than the Vercel + Render split in `docs/DEPLOYMENT.md`:

- **Free and permanent**, with no credit card.
- **16 GB RAM** on the free tier, against Render's 512 MB.
- It builds from a `Dockerfile`, so the OCR system packages pip cannot provide
  (tesseract, Poppler) can be installed.
- One origin means the browser makes same-origin requests and **CORS is not involved
  at all**.

## How the payload is assembled

The Space repository needs `Dockerfile` and `README.md` at its **root**, with the
backend and the built frontend beside them. Those two files here are copied in
verbatim; the code is copied from the repository:

```
<hf-space>/
├── Dockerfile              <- copied from here
├── README.md               <- copied from here (Space metadata lives in its frontmatter)
├── backend/                <- repository backend/, minus caches, .venv, tests, staging
└── frontend/dist/          <- built by `npm run build` in frontend/
```

Two things must be true before assembling:

1. The frontend is built, with **no** `VITE_API_KEY` in the environment. The build
   script checks that; every `VITE_` value ends up in the JavaScript a visitor
   downloads.
2. `backend/tests/` is excluded. It is not needed to run the service, and the
   redaction tests embed a PEM private-key fixture that should not be published.

## What the image installs, and what it does not

| Installed | Why |
| --- | --- |
| `backend/requirements-web.txt` | FastAPI, uvicorn, pydantic, numpy, cryptography, pypdf. The whole read path and the whole medical-report feature. |
| `pytesseract`, `pdf2image`, `Pillow` + apt `tesseract-ocr`, `poppler-utils` | OCR for scanned PDFs and image reports. |

**Not installed:** `torch`, MONAI, scipy, nibabel, opacus, Flower. Torch alone is
511 MB and the read paths do not need it, so the training endpoints answer an honest
**503 `training_unavailable`** rather than failing obscurely. If you want training to
run in the Space too, swap `requirements-web.txt` for `requirements.txt` — the free
tier's 16 GB is enough (measured: 348 MB peak with torch loaded).

## Environment set by the Dockerfile

| Variable | Value | Effect |
| --- | --- | --- |
| `FEDMED_SERVE_FRONTEND` | `true` | Serve `frontend/dist` at `/` and return the entry document for client-side routes, so a refresh on `/medical-reports` works. |
| `FEDMED_FRONTEND_DIR` | `/app/frontend/dist` | Where the build is. |
| `FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO` | `true` | Lets anonymous visitors use the report feature. Needed because an API key cannot be shipped to a browser. **Synthetic data only.** |
| `FEDMED_STAGING_DIR` | `/tmp/fedmed-staging` | Upload staging, discarded with the container. |

`FEDMED_API_KEYS` is deliberately **not** set. With no keys configured the protected
endpoints refuse with **503 `auth_not_configured`** instead of allowing anonymous
access, and the report routes open only because the public-demo flag says so
explicitly. See the section on that flag in `docs/DEPLOYMENT.md`.

## Not a medical device

The MRI model is trained on procedurally generated synthetic phantoms. The report
analysis is an aid for preparing a consultation, not a diagnosis. Nothing in this
deployment is clinically validated, and no real patient data should be uploaded to it.
