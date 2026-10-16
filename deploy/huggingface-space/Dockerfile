# Hugging Face Space — FedMed dashboard (the lean web tier), serving its own frontend.
#
# Why this shape
# --------------
# Pages and API share one origin, so the browser makes same-origin requests and CORS is
# not involved at all. The alternative (pages on Vercel, API elsewhere) needs an API URL
# configured in a frontend build, which is one more thing to get wrong.
#
# What is NOT installed, deliberately
# -----------------------------------
# torch, MONAI, scipy, nibabel, opacus and Flower. The read paths and the whole
# medical-report feature do not need them, and torch alone is 511 MB. Without torch the
# training endpoints refuse with an honest 503 training_unavailable rather than failing
# obscurely. Add requirements.txt instead of requirements-web.txt if you want training
# to run here too -- this Space's free tier has 16 GB, which is enough.
#
# OCR IS installed, including the system packages pip cannot provide. Without them a
# scanned PDF or an image report would be reported as unreadable, which is honest but
# makes the feature much less useful.
FROM python:3.14-slim

# tesseract-ocr is the OCR engine itself; poppler-utils gives pdf2image a PDF
# rasteriser. Both are apt packages, so they cannot live in requirements-web.txt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, in their own layer, so editing app code does not reinstall them.
COPY backend/requirements-web.txt ./backend/requirements-web.txt
RUN pip install --no-cache-dir -r backend/requirements-web.txt \
    && pip install --no-cache-dir pytesseract==0.3.13 pdf2image==1.17.0 Pillow==12.3.0

COPY backend/ ./backend/
COPY frontend/dist/ ./frontend/dist/

ENV FEDMED_ENVIRONMENT=production \
    FEDMED_LOG_LEVEL=info \
    FEDMED_SERVE_FRONTEND=true \
    FEDMED_FRONTEND_DIR=/app/frontend/dist \
    FEDMED_AUTH_REQUIRED_FOR_READS=false \
    FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO=true \
    FEDMED_STAGING_DIR=/tmp/fedmed-staging

# Hugging Face Spaces routes to this port and requires 0.0.0.0: the app's own default
# is 127.0.0.1, which is unreachable from outside the container.
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--app-dir", "backend"]
