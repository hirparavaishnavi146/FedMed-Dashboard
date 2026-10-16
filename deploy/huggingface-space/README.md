---
title: FedMed Dashboard
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Federated MRI research dashboard with report analysis
---

# FedMed — research prototype dashboard

A cross-silo federated-learning research prototype for MRI segmentation, plus an
AI-assisted medical report analysis feature.

**This is a research prototype. It is not a medical device, it is not clinically
validated, and it does not diagnose anything.** The MRI model is trained on
procedurally generated synthetic phantoms, not on scans of anyone. Nothing here should
be used to make a decision about a person's health.

## What works here

- The dashboard, hospital, model-results, datasets, case-intake, privacy and
  medical-report pages, served from this Space together with the API on one origin.
- Uploading one to three medical reports for one patient, extracting the facts from
  them, comparing them across reports, and producing a structured decision-support
  draft for review with a clinician.
- OCR for scanned PDFs and image reports (Tesseract and Poppler are installed).
- PDF text extraction (pypdf).

## What deliberately does not

- **Training.** `torch`/MONAI are not installed in this image, so the training
  endpoints answer **503 `training_unavailable`** with a readable reason rather than
  failing obscurely. Training runs in a local research environment.
- **The AI-generated sections** of the report analysis (possible complications,
  clinical suggestions, the narrative summary) need an AI provider configured through
  `FEDMED_AI_BASE_URL` / `FEDMED_AI_API_KEY`. Without one they report themselves
  **unavailable** — no placeholder text is invented to fill them. The measured
  findings, the comparison and the urgency scan work regardless.

## Please do not upload real medical records

This Space runs with `FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO=true`, which means anyone can
upload without an API key. That is necessary for a public demo — a Vite build compiles
every `VITE_` value into the JavaScript a visitor downloads, so an API key cannot be
shipped to the page — but it also means uploaded files are not protected by anything.
Use synthetic examples only. The page shows a banner saying so.

Uploaded reports are written to a temporary directory inside this Space's container and
deleted when the session is discarded or the container restarts.
