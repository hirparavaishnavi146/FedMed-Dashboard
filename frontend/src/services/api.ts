// Central API access. No component may build a URL itself - everything goes
// through here so there is exactly one place to change the backend address.
//
// The FastAPI backend (Stage 2) serves every endpoint under /api/v1 and wraps
// successful payloads in an envelope: { data, meta }. The helpers below unwrap
// that, so pages still receive plain typed objects and need no knowledge of the
// transport shape.

import type {
  CaseCapabilities,
  CaseSummary,
  DashboardMetrics,
  DatasetDeleteResult,
  DatasetFormats,
  DatasetSummary,
  Envelope,
  FederatedHistory,
  HealthStatus,
  Hospital,
  ImagingExperiment,
  ImagingJobConfig,
  ImagingJobStatus,
  MedicalAnalysis,
  MedicalReportHealth,
  MedicalComparison,
  ReportSession,
  ReportUploadResult,
  MetricPoint,
  ModelResults,
  PrivacyAccountResult,
  SecurityEvent,
  SecurityStatus,
  TrainingConfig,
  TrainingConfigResponse,
  TrainingStatus,
} from '../types';

/** Backend origin, read once from the environment. Never hardcoded per component. */
const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

/**
 * An empty or whitespace VITE_API_BASE_URL is treated as unset.
 *
 * `?? ` alone would keep an empty string, and every request URL would then be
 * relative to whatever host served the page — on a static deploy that means
 * /api/v1/... hits the static file server and returns 404, which reads as a
 * broken app rather than as a missing configuration. vite.config.ts also refuses
 * a production build that has demo mode off and no API URL, so this fallback
 * cannot silently ship.
 *
 * SAME ORIGIN is the deliberate exception. When the API itself serves these pages
 * (FEDMED_SERVE_FRONTEND on the backend, used when one port is exposed through a
 * tunnel or reverse proxy) the API lives on the page's own origin. Setting
 * VITE_API_SAME_ORIGIN=true makes every request relative, which also removes CORS
 * from the picture entirely. It must be opted into explicitly, so it can never be
 * the accidental result of a missing variable.
 */
export const API_SAME_ORIGIN: boolean =
  (import.meta.env.VITE_API_SAME_ORIGIN ?? 'false') === 'true';

export const API_BASE_URL: string = configuredBase || (API_SAME_ORIGIN ? '' : 'http://127.0.0.1:8000');

/**
 * Demo mode renders clearly labelled sample data and makes no network requests.
 * It is ON by default so the UI is usable before the backend exists.
 */
export const IS_DEMO_MODE: boolean =
  (import.meta.env.VITE_USE_DEMO_DATA ?? 'true') !== 'false';

/**
 * Optional API key, sent as X-API-Key when set. The backend refuses the privileged
 * endpoints with 503 when it has no keys configured and 401 without a valid one.
 *
 * Set VITE_API_KEY in frontend/.env.local (Git-ignored). Anything with a VITE_
 * prefix ends up in the built JavaScript and is visible to anyone, so this is for
 * local development against your own server only.
 */
export const API_KEY: string | null = import.meta.env.VITE_API_KEY ?? null;

const TIMEOUT_MS: number =
  Number(import.meta.env.VITE_API_TIMEOUT_SECONDS ?? '30') * 1000;

/**
 * Timeout for the report-analysis calls, which are not comparable to the rest.
 *
 * The analysis step makes a live model call to the configured AI provider, and that
 * takes tens of seconds -- measured at well over the default limit. A short timeout
 * here is not a safety feature: the server carries on working, the user is told the
 * request failed, and the finished analysis is never shown. Extraction can involve OCR
 * of a multi-page scan, so it gets the same allowance.
 */
const REPORT_TIMEOUT_MS: number =
  Number(import.meta.env.VITE_API_REPORT_TIMEOUT_SECONDS ?? '180') * 1000;

/** Error type thrown by every request, so pages can show a readable message. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly path: string;
  /** Machine-readable code from the backend, e.g. "hospital_not_found". */
  readonly code: string | null;

  constructor(
    message: string,
    status: number | null,
    path: string,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        // Accept is required on every request; the caller's headers override it.
        Accept: 'application/json',
        // ngrok's free tier answers a BROWSER request with an HTML interstitial
        // ("You are about to visit...") instead of passing it through, which makes
        // every fetch fail with "Failed to fetch" while curl works fine. This header
        // suppresses it. It is meaningful only to ngrok and is ignored by every other
        // host, so sending it unconditionally is safe.
        'ngrok-skip-browser-warning': 'true',
        ...(init?.headers ?? {}),
        // Sent only when configured. VITE_API_KEY lives in frontend/.env.local,
        // which is Git-ignored. This puts the key in browser JavaScript, so it is a
        // development convenience ONLY and never appropriate for a real credential.
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      // The backend returns {"error": {code, message, detail}}. Prefer its
      // message over a generic one, so the UI can show the real reason.
      let message = `Request failed with status ${response.status}`;
      let code: string | null = null;
      try {
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (body.error?.message) message = body.error.message;
        if (body.error?.code) code = body.error.code;
      } catch {
        /* the response carried no JSON body; keep the generic message */
      }
      throw new ApiError(message, response.status, path, code);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      // The base is empty in same-origin mode, and interpolating it produced
      // "Is the backend running at ?" -- which names nothing the user can act on.
      const where = API_BASE_URL || 'this server';
      throw new ApiError(
        `Request timed out after ${timeoutMs / 1000}s. Is the backend running at ${where}?`,
        null,
        path,
      );
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown network error',
      null,
      path,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

/** Request an endpoint and unwrap the { data, meta } envelope. */
async function requestData<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const envelope = await request<Envelope<T>>(path, init, timeoutMs);
  return envelope.data;
}

function postJson(body?: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

/** The API surface. Paths live here and nowhere else. */
export const api = {
  health: () => request<HealthStatus>('/health'),

  dashboardMetrics: () => requestData<DashboardMetrics>('/api/v1/dashboard/metrics'),

  hospitals: () => requestData<Hospital[]>('/api/v1/hospitals'),

  trainingStatus: () => requestData<TrainingStatus>('/api/v1/training/status'),
  /** Returns the run's rounds plus `source` / `measured`, never a bare array. */
  trainingHistory: () => requestData<FederatedHistory>('/api/v1/training/history'),
  trainingMetrics: (limit?: number) =>
    requestData<MetricPoint[]>(`/api/v1/training/metrics${limit ? `?limit=${limit}` : ''}`),
  /** Describes the federation: strategy, clients, and its own limitations. */
  trainingConfig: () => requestData<TrainingConfigResponse>('/api/v1/training/config'),

  /**
   * Start a federated run. The clients genuinely train locally and the server
   * aggregates their parameters; the data is synthetic and every client runs on
   * this machine. The response states that in `execution` / `measured`.
   *
   * A request for an unimplemented privacy mechanism is refused with 422 rather
   * than run without it.
   */
  startTraining: (config?: Partial<TrainingConfig>) =>
    requestData<TrainingStatus>(
      '/api/v1/training/start',
      postJson(config ? { config } : {}),
    ),
  stopTraining: () => requestData<TrainingStatus>('/api/v1/training/stop', postJson()),
  resetTraining: () => requestData<TrainingStatus>('/api/v1/training/reset', postJson()),

  modelResults: () => requestData<ModelResults>('/api/v1/model/results'),
  /** The measured 3D U-Net experiment, or an explicit `available: false`. */
  modelExperiment: () => requestData<ImagingExperiment>('/api/v1/model/experiment'),

  securityStatus: () => requestData<SecurityStatus>('/api/v1/security/status'),
  securityEvents: (limit?: number) =>
    requestData<SecurityEvent[]>(
      `/api/v1/security/events${limit ? `?limit=${limit}` : ''}`,
    ),
  /**
   * Account the privacy budget of a DP configuration. Never starts training; it
   * computes epsilon from the configuration using Opacus's RDP accountant.
   */
  accountPrivacy: (config: {
    enabled: boolean;
    noiseMultiplier: number;
    clippingNorm: number;
    sampleRate?: number | null;
    numRounds: number;
    targetDelta: number;
    targetEpsilon?: number | null;
  }) =>
    requestData<PrivacyAccountResult>(
      '/api/v1/security/privacy/account',
      postJson(config),
    ),

  // --- Dataset management (the MRI dataset workflow) ------------------------

  /**
   * The expected folder structure, accepted formats and limits, served by the API
   * rather than duplicated here, so the guidance cannot drift from the validator.
   */
  datasetFormats: () => requestData<DatasetFormats>('/api/v1/datasets/formats'),

  /** Hospital clients a dataset can be assigned to. */
  datasetClients: () =>
    requestData<{ id: string; name: string; location: string }[]>('/api/v1/datasets/clients'),

  /** Validated datasets, including per-case detail and current assignment. */
  datasets: () => requestData<{ datasets: DatasetSummary[]; total: number }>('/api/v1/datasets'),

  dataset: (id: string) => requestData<DatasetSummary>(`/api/v1/datasets/${id}`),

  /**
   * Validate a dataset directory already on the server. Nothing is uploaded and
   * nothing is modified: the files are read.
   */
  validateDatasetDirectory: (path: string, name?: string) =>
    requestData<DatasetSummary>(
      '/api/v1/datasets/validate-directory',
      postJson(name ? { path, name } : { path }),
    ),

  /** Upload files, then validate them with the same validator. */
  uploadDataset: async (files: File[], name?: string): Promise<DatasetSummary> => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (name) form.append('name', name);
    // No Content-Type header: the browser must set the multipart boundary.
    return requestData<DatasetSummary>('/api/v1/datasets/upload', {
      method: 'POST',
      body: form,
    });
  },

  /** Assign a validated dataset to a hospital client. */
  assignDataset: (id: string, hospitalId: string) =>
    requestData<DatasetSummary>(
      `/api/v1/datasets/${id}/assign`,
      postJson({ hospitalId }),
    ),

  /** Remove a dataset. Staged upload files are deleted from disk; server-side
   *  directories are left untouched. */
  deleteDataset: (id: string) =>
    requestData<DatasetDeleteResult>(`/api/v1/datasets/${id}`, { method: 'DELETE' }),

  /** Start a REAL 3D U-Net training job. Refuses if the dataset is not ready. */
  startImagingTraining: (datasetId: string, config?: Partial<ImagingJobConfig>) =>
    requestData<ImagingJobStatus>(
      '/api/v1/datasets/training/start',
      postJson(config ? { datasetId, config } : { datasetId }),
    ),

  /** Job state, progress, measured loss and Dice. `available: false` when this
   *  deployment has no torch, with the reason. */
  imagingTrainingStatus: () =>
    requestData<ImagingJobStatus>('/api/v1/datasets/training/status'),

  stopImagingTraining: () =>
    requestData<ImagingJobStatus>('/api/v1/datasets/training/stop', postJson()),

  resetImagingTraining: () =>
    requestData<ImagingJobStatus>('/api/v1/datasets/training/reset', postJson()),

  // --- Case intake (mixed uploads) ------------------------------------------

  /** What can and cannot be done with each input type. Served, not restated here. */
  caseCapabilities: () => requestData<CaseCapabilities>('/api/v1/cases/capabilities'),

  cases: () => requestData<{ cases: CaseSummary[]; total: number }>('/api/v1/cases'),

  case: (id: string) => requestData<CaseSummary>(`/api/v1/cases/${id}`),

  /**
   * Upload a mixed set of files as one case. Accepts PDFs, text, 2D images and MRI
   * volumes on purpose: the response explains what each one is, which requires
   * receiving them rather than refusing them at the door.
   *
   * The response states `interpretationSupported: false`; nothing here diagnoses.
   */
  intakeCase: async (files: File[], name?: string): Promise<CaseSummary> => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (name) form.append('name', name);
    // No Content-Type header: the browser must set the multipart boundary.
    return requestData<CaseSummary>('/api/v1/cases/intake', {
      method: 'POST',
      body: form,
    });
  },

  /** Summarise a case directory already on the server. Read only. */
  intakeCaseDirectory: (path: string, name?: string) =>
    requestData<CaseSummary>(
      '/api/v1/cases/validate-directory',
      postJson(name ? { path, name } : { path }),
    ),

  deleteCase: (id: string) =>
    requestData<{ id: string; deleted: boolean; detail: string }>(
      `/api/v1/cases/${id}`,
      { method: 'DELETE' },
    ),

  // --- Medical report analysis ----------------------------------------------
  //
  // Every one of these endpoints requires an API key, including the reads: this
  // feature handles real medical documents, unlike the synthetic dashboard.
  //
  // They also get REPORT_TIMEOUT_MS rather than the default. Analysis makes a live
  // model call and extraction may OCR a multi-page scan; both routinely exceed a
  // normal request budget, and aborting them tells the user it failed while the
  // server goes on to finish the work.

  /** What the subsystem can do right now: AI provider and OCR availability. */
  medicalReportHealth: () =>
    requestData<MedicalReportHealth>('/api/v1/medical-reports/health'),

  createReportSession: () =>
    requestData<ReportSession>('/api/v1/medical-reports/sessions', postJson()),

  reportSession: (sessionId: string) =>
    requestData<ReportSession>(`/api/v1/medical-reports/sessions/${sessionId}`),

  /** Upload one to three reports. Text extraction runs on upload. */
  uploadReports: async (sessionId: string, files: File[]): Promise<ReportUploadResult> => {
    const form = new FormData();
    form.append('session_id', sessionId);
    for (const file of files) form.append('files', file);
    // No Content-Type header: the browser must set the multipart boundary.
    return requestData<ReportUploadResult>(
      '/api/v1/medical-reports/upload',
      {
        method: 'POST',
        body: form,
      },
      REPORT_TIMEOUT_MS,
    );
  },

  /** Extraction and parsed facts, for the review screen. */
  extractReports: (sessionId: string) =>
    requestData<{
      sessionId: string;
      reports: Record<string, unknown>[];
      ocr: Record<string, unknown>;
      note: string;
    }>('/api/v1/medical-reports/extract', postJson({ sessionId }), REPORT_TIMEOUT_MS),

  confirmSamePatient: (sessionId: string, confirmed: boolean) =>
    requestData<ReportSession>(
      '/api/v1/medical-reports/confirm',
      postJson({ sessionId, confirmed }),
    ),

  compareReports: (sessionId: string) =>
    requestData<{ sessionId: string; comparison: MedicalComparison; reportCount: number }>(
      '/api/v1/medical-reports/compare',
      postJson({ sessionId }),
      REPORT_TIMEOUT_MS,
    ),

  /** Run the analysis. Generated sections report their own availability. */
  analyzeReports: (sessionId: string) =>
    requestData<MedicalAnalysis>(
      '/api/v1/medical-reports/analyze',
      postJson({ sessionId }),
      REPORT_TIMEOUT_MS,
    ),

  medicalAnalysis: (analysisId: string) =>
    requestData<MedicalAnalysis>(`/api/v1/medical-reports/analysis/${analysisId}`),

  deleteReportSession: (sessionId: string) =>
    requestData<{ sessionId: string; deleted: boolean; filesRemoved: boolean; detail: string }>(
      `/api/v1/medical-reports/sessions/${sessionId}`,
      { method: 'DELETE' },
    ),
};
