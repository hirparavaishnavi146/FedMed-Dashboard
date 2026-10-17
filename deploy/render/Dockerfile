# FedMed dashboard -- one container, one origin.
#
# The built frontend is COMMITTED to this repository, so the image does not need Node.
# That is deliberate:
#
#   * A Render Free instance has 512 MB of RAM. `npm ci` plus a Vite production build
#     peaks well above what is left after the base image, and the failure mode is an
#     out-of-memory kill during the build -- which reads as a generic "deploy failed"
#     with no obvious cause.
#   * Building the pages at image-build time also means the browser bundle's API base is
#     decided by build arguments. Committing a bundle built with VITE_API_SAME_ORIGIN
#     makes that decision reviewable in the repository.
#
# Rebuild the committed bundle (from frontend/) with:
#   VITE_API_SAME_ORIGIN=true VITE_API_BASE_URL="" VITE_USE_DEMO_DATA=false \
#   VITE_HASH_ROUTER=false VITE_API_KEY="" npm run build
#
# What is NOT installed, deliberately: torch, MONAI, scipy, nibabel, opacus, Flower.
# torch alone is 511 MB and a Free instance has 512 MB. Without them the training
# endpoints answer 503 training_unavailable -- an honest refusal rather than a failure
# that looks like a bug. The read paths never import them.
#
# tesseract-ocr and poppler-utils ARE installed: they are what make a scanned report, or
# a photograph of one, readable instead of "unreadable", and pip cannot provide them.

FROM python:3.14-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies in their own layer, so editing application code does not reinstall them.
COPY backend/requirements-web.txt ./backend/requirements-web.txt
RUN pip install --no-cache-dir -r backend/requirements-web.txt \
    && pip install --no-cache-dir pytesseract==0.3.13 pdf2image==1.17.0 Pillow==12.3.0

# Application code only. backend/tests is deliberately absent: its fixtures embed a
# private key, and a deployed container has no use for them.
COPY backend/app ./backend/app
COPY frontend/dist ./frontend/dist

ENV FEDMED_ENVIRONMENT=production \
    FEDMED_LOG_LEVEL=info \
    FEDMED_SERVE_FRONTEND=true \
    FEDMED_FRONTEND_DIR=/app/frontend/dist \
    FEDMED_AUTH_REQUIRED_FOR_READS=false \
    FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO=true \
    FEDMED_STAGING_DIR=/tmp/fedmed-staging

# Render supplies $PORT, so this is expanded by a shell at run time. Binding 0.0.0.0 is
# required: the application's own default host is 127.0.0.1, reachable only inside the
# container.
EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend
