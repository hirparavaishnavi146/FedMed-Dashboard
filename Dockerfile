# FedMed dashboard on Render -- one container, one origin.
#
# Why Docker, and not Render's native Python runtime
# --------------------------------------------------
# A native Python service installs pip packages and nothing else. This app also needs:
#
#   * a frontend BUILD step (Node). frontend/dist is git-ignored, so no built pages
#     exist in the repository for a runtime to serve.
#   * tesseract-ocr and poppler-utils as SYSTEM packages. These are what make a scanned
#     report, or a photograph of one, readable instead of "unreadable" -- and pip cannot
#     install them.
#
# Docker provides all three, and the API serves the built pages itself, so the browser
# makes same-origin requests and CORS is never involved: there is no origin to configure
# and no API hostname to bake into a build.
#
# What is NOT installed, deliberately: torch, MONAI, scipy, nibabel, opacus, Flower.
# torch alone is 511 MB and a Free instance has 512 MB of RAM. Without them the training
# endpoints answer 503 training_unavailable -- an honest refusal rather than a failure
# that looks like a bug. The read paths and the whole medical-report feature never
# import them.

# ---------- stage 1: build the frontend ----------
FROM node:22-slim AS frontend

WORKDIR /build
# The lockfile decides the versions, so `npm ci` keeps a build from drifting.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Same-origin means every request is RELATIVE, so nothing about the deployment's own
# hostname has to be known at build time. VITE_API_KEY stays empty on purpose: every
# VITE_ value is compiled into the JavaScript a browser downloads, so a key here would
# be a published key. The report routes are opened to anonymous visitors by
# FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO instead, which lives in the host environment.
#
# The report-analysis budget is 180s because the analysis calls a live model and can
# take a minute or more; aborting it at the default would report a failure the server
# never had.
ENV VITE_API_SAME_ORIGIN=true \
    VITE_API_BASE_URL="" \
    VITE_USE_DEMO_DATA=false \
    VITE_HASH_ROUTER=false \
    VITE_API_KEY="" \
    VITE_API_TIMEOUT_SECONDS=30 \
    VITE_API_REPORT_TIMEOUT_SECONDS=180
RUN npm run build

# ---------- stage 2: the API ----------
FROM python:3.14-slim

# tesseract-ocr is the OCR engine; poppler-utils gives pdf2image its PDF rasteriser.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies in their own layer, so editing application code does not reinstall them.
COPY backend/requirements-web.txt ./backend/requirements-web.txt
RUN pip install --no-cache-dir -r backend/requirements-web.txt \
    && pip install --no-cache-dir pytesseract==0.3.13 pdf2image==1.17.0 Pillow==12.3.0

# Application code only. tests/ is deliberately not copied: its fixtures embed key
# material, and a deployed container has no use for them.
COPY backend/app ./backend/app
COPY --from=frontend /build/dist ./frontend/dist

ENV FEDMED_ENVIRONMENT=production \
    FEDMED_LOG_LEVEL=info \
    FEDMED_SERVE_FRONTEND=true \
    FEDMED_FRONTEND_DIR=/app/frontend/dist \
    FEDMED_AUTH_REQUIRED_FOR_READS=false \
    FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO=true \
    FEDMED_STAGING_DIR=/tmp/fedmed-staging

# Render supplies $PORT, so the command is expanded by a shell at run time. Binding
# 0.0.0.0 is required: the application's own default host is 127.0.0.1, which is
# reachable only from inside the container.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend
