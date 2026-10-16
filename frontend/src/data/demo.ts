// ---------------------------------------------------------------------------
// ALL DATA IN THIS FILE IS ILLUSTRATIVE DEMO DATA.
// It does not come from a real hospital, a real MRI scanner, or a real model.
// The UI labels it as demo everywhere it is shown.
// ---------------------------------------------------------------------------

import type {
  ActivityEvent,
  DashboardMetrics,
  DatasetFormats,
  DatasetSummary,
  FederatedHistory,
  FederatedRound,
  Hospital,
  ImagingExperiment,
  MetricPoint,
  ModelResults,
  ModelVersion,
  PrivacyMechanism,
  SecurityEvent,
  SecurityStatus,
  TrainingConfig,
  TrainingConfigResponse,
  TrainingStatus,
} from '../types';

/** Shown in the header badge and on pages that display sample values. */
export const DEMO_LABEL = 'DEMO DATA';
export const DEMO_EXPLANATION =
  'Sample values for interface development. No real hospital, patient, scanner or trained model is connected.';

export const DEMO_HOSPITALS: Hospital[] = [
  {
    id: 'HOSP-01',
    name: 'Northbridge Medical Centre',
    location: 'Boston, United States',
    nodeId: 'client-northbridge:8081',
    status: 'online',
    datasetStatus: 'ready',
    studies: 412,
    sizeGb: 38.4,
    lastSync: '2026-10-10T09:42:00+05:30',
    localTraining: 'complete',
    roundsContributed: 8,
    privacyBudgetUsed: 0.72,
    split: 'train 70% / val 15% / test 15%',
    notes:
      'Synthetic brain MRI phantoms with T1-weighted contrast. No identifiable patient data.',
  },
  {
    id: 'HOSP-02',
    name: 'St. Aurelia University Hospital',
    location: 'Utrecht, Netherlands',
    nodeId: 'client-aurelia:8082',
    status: 'online',
    datasetStatus: 'ready',
    studies: 356,
    sizeGb: 31.1,
    lastSync: '2026-10-10T09:44:00+05:30',
    localTraining: 'training',
    roundsContributed: 8,
    privacyBudgetUsed: 1.15,
    split: 'train 75% / val 12.5% / test 12.5%',
    notes: 'Synthetic phantom volumes, harmonised voxel spacing before local training.',
  },
  {
    id: 'HOSP-03',
    name: 'Riverside Children\u2019s Research Institute',
    location: 'Toronto, Canada',
    nodeId: 'client-riverside:8083',
    status: 'degraded',
    datasetStatus: 'partial',
    studies: 198,
    sizeGb: 17.6,
    lastSync: '2026-10-10T08:58:00+05:30',
    localTraining: 'failed',
    roundsContributed: 6,
    privacyBudgetUsed: 2.04,
    split: 'train 60% / val 20% / test 20%',
    notes:
      'Two of three synthetic sub-datasets prepared. Last local run stopped on a memory limit (simulated).',
  },
];

/**
 * Round history. Values trend downwards/upwards the way a healthy run would.
 *
 * `measured: false` is not decoration: these are illustrative, and the UI uses
 * that flag to label them instead of presenting them as experiment results. The
 * backend sends the same field, true only for rounds a real run produced.
 */
const DEMO_ROUND_ROWS = [
  { round: 1, loss: 0.842, dice: 0.412, accuracy: 0.731, participants: 3, seconds: 512, at: '2026-10-10T06:10:00+05:30' },
  { round: 2, loss: 0.671, dice: 0.507, accuracy: 0.786, participants: 3, seconds: 498, at: '2026-10-10T06:42:00+05:30' },
  { round: 3, loss: 0.548, dice: 0.581, accuracy: 0.822, participants: 3, seconds: 505, at: '2026-10-10T07:14:00+05:30' },
  { round: 4, loss: 0.431, dice: 0.646, accuracy: 0.858, participants: 3, seconds: 489, at: '2026-10-10T07:46:00+05:30' },
  { round: 5, loss: 0.352, dice: 0.702, accuracy: 0.883, participants: 3, seconds: 473, at: '2026-10-10T08:18:00+05:30' },
  { round: 6, loss: 0.288, dice: 0.746, accuracy: 0.902, participants: 2, seconds: 441, at: '2026-10-10T08:50:00+05:30' },
  { round: 7, loss: 0.241, dice: 0.779, accuracy: 0.917, participants: 3, seconds: 455, at: '2026-10-10T09:22:00+05:30' },
  { round: 8, loss: 0.209, dice: 0.804, accuracy: 0.928, participants: 3, seconds: 462, at: '2026-10-10T09:44:00+05:30' },
];

export const DEMO_ROUNDS: FederatedRound[] = DEMO_ROUND_ROWS.map((row) => ({
  round: row.round,
  strategy: 'FedAvg',
  measured: false,
  participants: row.participants,
  expectedParticipants: 3,
  participatingClients: DEMO_HOSPITALS.slice(0, row.participants).map((hospital) => hospital.id),
  // A seeded row has no per-client breakdown and no measured totals: only a real
  // run produces those, so they are empty here rather than invented.
  clients: [],
  excludedClients: [],
  totalExamples: 0,
  aggregatedLoss: row.loss,
  aggregatedValidationLoss: row.loss,
  aggregatedValidationDice: row.dice,
  durationSeconds: row.seconds,
  startedAt: row.at,
  finishedAt: row.at,
  aggregatedParameters: 553,
}));

/** Validation loss is drawn slightly above training loss, as it usually is. */
export const DEMO_METRIC_HISTORY: MetricPoint[] = DEMO_ROUNDS.map((round, index) => ({
  round: round.round,
  loss: round.aggregatedLoss,
  validationLoss: Number((round.aggregatedLoss * (1.06 + index * 0.004)).toFixed(3)),
  dice: round.aggregatedValidationDice ?? 0,
  accuracy: DEMO_ROUND_ROWS[index]?.accuracy ?? 0,
}));

/** GET /api/v1/training/history, in demo mode. */
export const DEMO_FEDERATED_HISTORY: FederatedHistory = {
  source: 'seed',
  measured: false,
  rounds: DEMO_ROUNDS,
  note:
    'Illustrative baseline. No federated run has been executed, so none of these rounds is a measurement.',
};

/** GET /api/v1/training/config, in demo mode. Mirrors the backend's own summary. */
export const DEMO_FEDERATED_CONFIG: TrainingConfigResponse = {
  strategy: 'FedAvg',
  strategiesSupported: ['FedAvg'],
  executionModes: ['local-simulation', 'distributed-local', 'cross-silo'],
  currentExecution: 'local-simulation',
  model: 'TinyPatchSegmenter',
  modelParameters: 553,
  clientModelDescription:
    'A small 3D convolutional network (~550 parameters) that segments a synthetic sphere in a 16x16x16 patch. It is a real trainable model used to exercise federated aggregation. It is NOT the MRI segmentation model: the 3D U-Net (PyTorch + MONAI) is a later stage and is not implemented.',
  clientProfiles: DEMO_HOSPITALS.map((hospital) => ({
    name: hospital.id,
    samples: hospital.studies,
    noise: 0.1,
    description: hospital.notes,
  })),
  aggregator: 'Sample-count-weighted average of client parameters',
  weighting:
    'Each client contributes in proportion to its local training example count, so a larger dataset carries more weight.',
  clientsSend: [
    'Model parameters (tensors) after local training',
    'The number of local training examples used as the aggregation weight',
    'The local training loss, for reporting',
  ],
  clientsNeverSend: [
    'Training examples',
    'Labels or segmentation masks',
    'Raw MRI volumes',
    'Patient identifiers',
  ],
  limitations: [
    'Clients are simulated on one machine; this is not a cross-silo deployment across hospital infrastructures.',
    'All data is synthetic; no real patient data is involved.',
    'The client model is a small stand-in, not the MRI 3D U-Net.',
    'No secure aggregation, homomorphic encryption or differential privacy is implemented.',
  ],
};

export const DEMO_MODELS: ModelVersion[] = [
  {
    version: 'v0.1.0',
    createdAt: '2026-10-09T18:00:00+05:30',
    status: 'archived',
    dice: 0.581,
    iou: 0.412,
    accuracy: 0.822,
    loss: 0.548,
    sensitivity: 0.604,
    specificity: 0.901,
    rounds: 3,
    notes: 'First smoke-test of the aggregation loop. Single-fold validation.',
  },
  {
    version: 'v0.2.0',
    createdAt: '2026-10-10T08:50:00+05:30',
    status: 'active',
    dice: 0.746,
    iou: 0.596,
    accuracy: 0.902,
    loss: 0.288,
    sensitivity: 0.771,
    specificity: 0.938,
    rounds: 6,
    notes: 'Best candidate so far. Excludes one client that failed mid-round.',
  },
  {
    version: 'v0.3.0',
    createdAt: '2026-10-10T09:44:00+05:30',
    status: 'candidate',
    dice: 0.804,
    iou: 0.671,
    accuracy: 0.928,
    loss: 0.209,
    sensitivity: 0.829,
    specificity: 0.951,
    rounds: 8,
    notes: 'Newest aggregation result. Not yet reviewed by the research team.',
  },
];

export const DEMO_ACTIVITY: ActivityEvent[] = [
  { id: 'act-8', timestamp: '2026-10-10T09:44:00+05:30', kind: 'round', title: 'Global round 8 aggregated', detail: '3 of 3 clients reported. Global Dice 0.804, loss 0.209.' },
  { id: 'act-7', timestamp: '2026-10-10T09:42:00+05:30', kind: 'client', title: 'Northbridge synced', detail: 'Local update uploaded for round 8 (38.4 GB local dataset).', hospitalId: 'HOSP-01' },
  { id: 'act-6', timestamp: '2026-10-10T09:31:00+05:30', kind: 'privacy', title: 'Noise budget check', detail: 'Privacy budget usage reported for all 3 clients. No client has exceeded its limit.' },
  { id: 'act-5', timestamp: '2026-10-10T09:12:00+05:30', kind: 'model', title: 'Candidate model saved', detail: 'v0.3.0 written to the model registry (demo entry).' },
  { id: 'act-4', timestamp: '2026-10-10T08:58:00+05:30', kind: 'client', title: 'Riverside reported a local failure', detail: 'Local training stopped: simulated memory limit reached.', hospitalId: 'HOSP-03' },
  { id: 'act-3', timestamp: '2026-10-10T08:50:00+05:30', kind: 'round', title: 'Global round 6 aggregated', detail: '2 of 3 clients reported; one was excluded from the average.' },
  { id: 'act-2', timestamp: '2026-10-10T08:20:00+05:30', kind: 'system', title: 'Round scheduler started', detail: 'Next round interval set to 30 minutes (demo scheduler).' },
  { id: 'act-1', timestamp: '2026-10-10T08:05:00+05:30', kind: 'system', title: 'Research session opened', detail: 'Dashboard loaded in demo mode.' },
];

export const DEMO_SECURITY_EVENTS: SecurityEvent[] = [
  { id: 'sec-6', timestamp: '2026-10-10T09:40:00+05:30', severity: 'info', category: 'Transport', message: 'TLS handshake completed with client-aurelia.', source: 'client-aurelia:8082' },
  { id: 'sec-5', timestamp: '2026-10-10T09:22:00+05:30', severity: 'warning', category: 'Integrity', message: 'Update checksum verified after one retry.', source: 'client-riverside:8083' },
  { id: 'sec-4', timestamp: '2026-10-10T09:05:00+05:30', severity: 'info', category: 'Access', message: 'Research role signed in to the dashboard.', source: 'dashboard' },
  { id: 'sec-3', timestamp: '2026-10-10T08:58:00+05:30', severity: 'warning', category: 'Availability', message: 'Client missed a round deadline and was excluded.', source: 'client-riverside:8083' },
  { id: 'sec-2', timestamp: '2026-10-10T08:30:00+05:30', severity: 'info', category: 'Privacy', message: 'Differential-privacy budget reset for the new session.', source: 'aggregator' },
  { id: 'sec-1', timestamp: '2026-10-10T08:05:00+05:30', severity: 'info', category: 'System', message: 'Audit log started. Entries below are simulated.', source: 'aggregator' },
];

/** Default values for the Training page form. */
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  rounds: 10,
  localEpochs: 2,
  learningRate: 0.001,
  batchSize: 2,
  aggregation: 'FedAvg',
  minClients: 2,
  validationSplit: 0.2,
  randomSeed: 42,
  patchSize: 16,
  // All three must default to false: the API refuses a run that requests an
  // unimplemented privacy mechanism (422) rather than silently running without
  // it, so defaulting any of these to true would break Start.
  useDifferentialPrivacy: false,
  useSecureAggregation: false,
  useHomomorphicEncryption: false,
};

/** Boundary values used to validate the training form. */
export const CONFIG_LIMITS = {
  rounds: { min: 1, max: 50 },
  localEpochs: { min: 1, max: 20 },
  learningRate: { min: 0.00001, max: 0.1 },
  batchSize: { min: 1, max: 8 },
  minClients: { min: 1, max: 3 },
  validationSplit: { min: 0.05, max: 0.5 },
  // The stand-in client model's patch, not an MRI volume. Matches the API's own
  // bounds (ge=8, le=32) so the form and the backend reject the same values.
  patchSize: { min: 8, max: 32 },
} as const;

/**
 * Privacy mechanisms and their honest implementation state.
 * Typed from the API contract so this list cannot drift from the backend.
 */
export const DEMO_PRIVACY_MECHANISMS: PrivacyMechanism[] = [
  {
    id: 'dp',
    name: 'Differential privacy',
    description:
      'Per-client gradient clipping and Gaussian noise before an update leaves the node. Not implemented - the epsilon value below is illustrative.',
    state: 'simulated',
    implemented: false,
    reference: 'Planned for milestone M5',
  },
  {
    id: 'secagg',
    name: 'Secure aggregation',
    description:
      'Clients mask their updates so the server only ever sees the sum. Not implemented - no cryptographic masking exists in the codebase.',
    state: 'planned',
    implemented: false,
    reference: 'Planned for milestone M5',
  },
  {
    id: 'he',
    name: 'Homomorphic encryption',
    description:
      'Federated averaging over encrypted updates with TenSEAL (CKKS). Not implemented - the toggle changes nothing yet.',
    state: 'planned',
    implemented: false,
    reference: 'Planned for milestone M5',
  },
  {
    id: 'tls',
    name: 'Transport encryption',
    description:
      'Mutual TLS between Flower clients and the server. Not implemented - Stage 1 has no network layer at all.',
    state: 'planned',
    implemented: false,
    reference: 'Planned for milestone M4',
  },
];

/** Illustrative epsilon values for the privacy page. */
export const DEMO_PRIVACY_SUMMARY = {
  mechanism: 'Gaussian (DP-SGD style)',
  noiseMultiplier: 1.1,
  clippingNorm: 1.0,
  targetEpsilon: 3.0,
  budgets: DEMO_HOSPITALS.map((hospital) => ({
    hospitalId: hospital.id,
    hospital: hospital.name,
    epsilon: hospital.privacyBudgetUsed,
  })),
};

// ---------------------------------------------------------------------------
// Derived demo payloads for the Stage 2 endpoints.
//
// Each one is computed from the constants above, so the file still holds exactly
// one set of sample values. A page in demo mode is handed one of these; in live
// mode it is handed the same shape by the FastAPI backend.
// ---------------------------------------------------------------------------

const demoStudiesTotal = DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.studies, 0);
const demoSizeTotal = Number(
  DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.sizeGb, 0).toFixed(2),
);
const demoAverageBudget = Number(
  (
    DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.privacyBudgetUsed, 0) /
    DEMO_HOSPITALS.length
  ).toFixed(2),
);
const demoOnline = DEMO_HOSPITALS.filter((hospital) => hospital.status === 'online').length;

/** GET /api/v1/dashboard/metrics */
export const DEMO_DASHBOARD_METRICS: DashboardMetrics = {
  participatingHospitals: demoOnline,
  totalHospitals: DEMO_HOSPITALS.length,
  hospitalSummary: {
    total: DEMO_HOSPITALS.length,
    online: demoOnline,
    degraded: DEMO_HOSPITALS.filter((hospital) => hospital.status === 'degraded').length,
    offline: DEMO_HOSPITALS.filter((hospital) => hospital.status === 'offline').length,
    totalStudies: demoStudiesTotal,
    totalSizeGb: demoSizeTotal,
    averagePrivacyBudgetUsed: demoAverageBudget,
  },
  federatedRounds: DEMO_ROUNDS.length,
  lastRoundAt: DEMO_ROUNDS.at(-1)?.finishedAt ?? null,
  currentModel: DEMO_MODELS.find((model) => model.status === 'active') ?? DEMO_MODELS[0] ?? null,
  trainingStatus: 'idle',
  trainingIsSimulated: true,
  trainingTrainsModel: false,
  trainingExecution: 'local-simulation',
  trainingMeasured: false,
  seededRounds: DEMO_ROUNDS,
  totalStudies: demoStudiesTotal,
  totalSizeGb: demoSizeTotal,
  averagePrivacyBudgetUsed: demoAverageBudget,
  privacyTargetEpsilon: DEMO_PRIVACY_SUMMARY.targetEpsilon,
  metricHistory: DEMO_METRIC_HISTORY,
  recentRounds: DEMO_ROUNDS.slice(-8),
  activity: DEMO_ACTIVITY,
  // Nothing was uploaded on a static demo, so the real counts are all zero. Shown as
  // zero rather than invented sample values: these are the one part of the dashboard
  // that is a measurement, and a filled-in number here would misrepresent it.
  reportActivity: {
    measured: false,
    sessions: 0,
    samePatientConfirmed: 0,
    reportsUploaded: 0,
    reportsReadable: 0,
    reportsUnreadable: 0,
    reportsReadByOcr: 0,
    analysesRun: 0,
    valuesExtracted: 0,
    valuesOutsidePrintedRange: 0,
    valuesWithoutPrintedRange: 0,
    documentedDiagnoses: 0,
    documentedMedications: 0,
    reportsWithRedFlags: 0,
    reportTypes: {},
    latestUrgency: null,
    note: 'Demo mode has no server, so there is nothing to count. Run the backend to see real totals from uploaded reports.',
  },
};

/** GET /api/v1/training/status */
export const DEMO_TRAINING_STATUS: TrainingStatus = {
  runId: null,
  status: 'idle',
  execution: 'local-simulation',
  measured: false,
  isSimulatedData: true,
  trainsOnRealPatientData: false,
  strategy: 'FedAvg',
  seed: 42,
  config: null,
  configDescription: 'No run has been started in this process.',
  clients: [],
  modelParameters: 553,
  totalRounds: 0,
  completedRounds: 0,
  currentRound: null,
  startedAt: null,
  finishedAt: null,
  firstLoss: null,
  lastLoss: null,
  lastValidationDice: null,
  lossImprovement: null,
  error: null,
  message:
    'Demo mode: no backend is running, so no federated run exists. Start the FastAPI backend to run one.',
  history: [],
};

/**
 * GET /api/v1/model/experiment, in demo mode.
 *
 * `available: false`, deliberately: demo mode has no backend and no run has been
 * performed, so there is no experiment to report. Showing fabricated epoch values
 * here would be exactly the placeholder-as-result mistake this field exists to
 * prevent.
 */
export const DEMO_IMAGING_EXPERIMENT: ImagingExperiment = {
  available: false,
  source: null,
  site: null,
  generatedAt: null,
  config: {},
  configDescription: null,
  epochs: [],
  epochCount: 0,
  firstTrainLoss: null,
  lastTrainLoss: null,
  lossImproved: null,
  bestDice: null,
  bestEpoch: null,
  holdout: null,
  model: null,
  provenance: null,
  durationSeconds: null,
  unavailableReason:
    'Demo mode: no backend is running, so no experiment result is available. Run the 3D U-Net experiment with `python -m app.imaging.pipeline` to produce one.',
};

/** GET /api/v1/model/results */
export const DEMO_MODEL_RESULTS: ModelResults = {
  models: DEMO_MODELS,
  activeVersion: DEMO_MODELS.find((model) => model.status === 'active') ?? null,
  bestVersion: DEMO_MODELS.reduce(
    (best, model) => (model.dice > best.dice ? model : best),
    DEMO_MODELS[0],
  ),
  latestVersion: DEMO_MODELS.at(-1) ?? null,
  registryIsIllustrative: true,
  registryNotice:
    'Every value in the version registry is illustrative sample data. No segmentation model produced these numbers.',
  measuredExperiment: DEMO_IMAGING_EXPERIMENT,
};

/** GET /api/v1/security/status */
export const DEMO_SECURITY_STATUS: SecurityStatus = {
  mechanismsImplemented: 0,
  mechanismsTotal: DEMO_PRIVACY_MECHANISMS.length,
  encryption: {
    transport: 'unknown',
    atRest: 'not implemented',
    note:
      'Demo mode: no backend is running, so the live transport state cannot be read. Start the API to see whether TLS is actually in effect.',
  },
  differentialPrivacy: {
    mechanism: DEMO_PRIVACY_SUMMARY.mechanism,
    noiseMultiplier: DEMO_PRIVACY_SUMMARY.noiseMultiplier,
    clippingNorm: DEMO_PRIVACY_SUMMARY.clippingNorm,
    targetEpsilon: DEMO_PRIVACY_SUMMARY.targetEpsilon,
    applied: false,
  },
  secureAggregationEnabled: false,
  homomorphicEncryptionEnabled: false,
  mechanisms: DEMO_PRIVACY_MECHANISMS,
  budgets: DEMO_PRIVACY_SUMMARY.budgets.map((budget) => ({
    ...budget,
    targetEpsilon: DEMO_PRIVACY_SUMMARY.targetEpsilon,
    exceeded: budget.epsilon > DEMO_PRIVACY_SUMMARY.targetEpsilon,
  })),
  events: [],
  // Demo mode has no backend, so nothing can be observed. Every feature reports the
  // state that is honestly true without a server: unconfigured, not enabled.
  features: [
    {
      id: 'auth',
      name: 'Authentication and authorization',
      state: 'unconfigured',
      implemented: true,
      enabled: false,
      description:
        'API keys compared by SHA-256 hash, with scope-based roles protecting the training and administration endpoints.',
      evidence:
        'Demo mode: no backend is running, so the configured key list cannot be read. Start the API to see the live state.',
      requirements: ['Start the API and configure FEDMED_API_KEYS'],
      reference: 'app/security/auth.py',
    },
    {
      id: 'tls',
      name: 'Transport security (TLS)',
      state: 'unconfigured',
      implemented: true,
      enabled: false,
      description: 'HTTPS for the API and TLS for the federated gRPC path.',
      evidence:
        'Demo mode: transport state is read from the request being served, and there is no server here.',
      requirements: ['Generate a certificate and serve with --ssl-certfile'],
      reference: 'app/security/tls.py',
    },
    {
      id: 'secagg',
      name: 'Secure aggregation',
      state: 'unconfigured',
      implemented: true,
      enabled: false,
      description:
        'Client updates are masked with pairwise pseudorandom masks so the server recovers only the weighted sum.',
      evidence:
        'Demo mode: the running configuration cannot be read, so no claim is made either way.',
      requirements: ['Set FEDMED_SECURE_AGGREGATION_SECRET'],
      reference: 'app/federated/secure_aggregation.py',
    },
    {
      id: 'dp',
      name: 'Differential privacy',
      state: 'unconfigured',
      implemented: true,
      enabled: false,
      description:
        'Client-side clipping with Gaussian noise on the aggregate, accounted with Opacus.',
      evidence: 'Demo mode: no epsilon has been accounted because no configuration is set.',
      requirements: ['Configure DP and call /security/privacy/account'],
      reference: 'app/federated/privacy.py',
    },
    {
      id: 'he',
      name: 'Homomorphic encryption',
      state: 'not_implemented',
      implemented: false,
      enabled: false,
      description:
        'Federated averaging over encrypted updates (TenSEAL/CKKS). Not implemented: no code imports TenSEAL.',
      evidence: 'No implementation exists.',
      requirements: ['Implement encryption of updates before aggregation'],
      reference: 'Not implemented',
    },
  ],
  authentication: null,
  transport: null,
  secureAggregation: null,
  privacyAccounting: null,
  audit: null,
  disclaimers: [
    'Demo mode: no backend is running, so no security configuration can be observed. Where a value is unknown it is shown as unknown rather than guessed.',
    'This application is not production-secure and has not been independently validated.',
  ],
};

// ---------------------------------------------------------------------------
// Dataset workflow, demo mode only.
//
// The Datasets page validates files and starts real training, so with no backend
// there is nothing to validate. Rather than fire requests that would fail with a
// 404 and make the page look broken, the page renders these illustrative rows and
// says plainly that they are samples. `valid: false` is used for the second row so
// the error presentation is visible too.
// ---------------------------------------------------------------------------

export const DEMO_DATASETS: DatasetSummary[] = [
  {
    id: 'demo-ds-001',
    name: 'sample-t2-prostate (illustrative)',
    source: 'server-directory',
    path: 'not read - demo mode',
    valid: true,
    caseCount: 12,
    validCaseCount: 12,
    errorCount: 0,
    warningCount: 1,
    totalBytes: 96 * 1024 * 1024,
    modality: 'not stated in the file',
    modalitySource:
      'NIfTI does not carry a reliable modality field. This is not an inference from the image content.',
    createdAt: '2026-01-01T00:00:00Z',
    issues: [],
    cases: [],
    limits: {
      maxFileBytes: 512 * 1024 * 1024,
      maxTotalBytes: 2 * 1024 * 1024 * 1024,
      maxCases: 500,
      minVoxels: 8,
      maxVoxels: 1024,
      acceptedSuffixes: ['.nii.gz', '.nii'],
    },
    assignedHospitalId: 'HOSP-01',
    assignedHospitalName: 'Northbridge Medical Centre',
    assignedAt: '2026-01-01T00:00:00Z',
    readyToTrain: true,
  },
  {
    id: 'demo-ds-002',
    name: 'sample-mismatched-grid (illustrative)',
    source: 'upload',
    path: 'not read - demo mode',
    valid: false,
    caseCount: 3,
    validCaseCount: 0,
    errorCount: 3,
    warningCount: 0,
    totalBytes: 18 * 1024 * 1024,
    modality: 'not stated in the file',
    modalitySource: 'Demo sample row.',
    createdAt: '2026-01-01T00:00:00Z',
    issues: [],
    cases: [
      {
        name: 'case_003.nii.gz',
        imagePath: 'case_003.nii.gz',
        labelPath: 'case_003_seg.nii.gz',
        imageShape: [32, 32, 32],
        labelShape: [16, 24, 20],
        spacing: [1, 1, 1],
        voxels: 32768,
        foregroundVoxels: 1200,
        foregroundFraction: 0.036,
        labelValues: [0, 1],
        valid: false,
        issues: [
          {
            code: 'shape_mismatch',
            severity: 'error',
            message:
              'Image is (32, 32, 32) but the mask is (16, 24, 20). The mask must be on the same voxel grid as the image.',
            case: 'case_003.nii.gz',
          },
        ],
      },
    ],
    limits: {
      maxFileBytes: 512 * 1024 * 1024,
      maxTotalBytes: 2 * 1024 * 1024 * 1024,
      maxCases: 500,
      minVoxels: 8,
      maxVoxels: 1024,
      acceptedSuffixes: ['.nii.gz', '.nii'],
    },
    assignedHospitalId: null,
    assignedHospitalName: null,
    assignedAt: null,
    readyToTrain: false,
  },
];

export const DEMO_DATASET_CLIENTS = [
  { id: 'HOSP-01', name: 'Northbridge Medical Centre', location: 'United Kingdom' },
  { id: 'HOSP-02', name: 'St. Aurelia University Hospital', location: 'Germany' },
  { id: 'HOSP-03', name: 'Lakeview Regional Imaging', location: 'Canada' },
];

/**
 * The format guide is static text, but in the live app it is served by
 * /api/v1/datasets/formats so it cannot drift from the validator. With no backend
 * there is nothing to fetch, so the same content is mirrored here and the page
 * says it is sample content. When the API is available it takes precedence.
 */
export const DEMO_DATASET_FORMATS: DatasetFormats = {
  formats: ['.nii.gz', '.nii'],
  formatNotes: {
    '.nii.gz': 'Compressed NIfTI-1. Preferred. Read by the existing MONAI pipeline.',
    '.nii': 'Uncompressed NIfTI-1. Also accepted.',
  },
  folderStructure: [
    'dataset_folder/',
    '  case_001.nii.gz        <- the image volume',
    '  case_001_seg.nii.gz    <- its mask, same name with _seg',
    '  case_002.nii.gz',
    '  case_002_seg.nii.gz',
  ],
  rules: [
    'One folder holds the whole dataset. Subfolders are searched too.',
    'Every <name>.nii.gz or <name>.nii needs <name>_seg.nii.gz next to it.',
    'Image and mask must be on the SAME voxel grid: identical shape and identical voxel size.',
    'Each case must be a single 3D volume. Split 4D series into separate volumes first.',
    'Masks must be binary: values 0 and 1 only. This model is binary segmentation.',
    'Minimum 8 voxels per axis; maximum 1024.',
    'Masks are checked for an empty or nearly-full segmentation and warned about.',
  ],
  notAccepted: {
    '.dcm': 'DICOM is not supported. Convert the series to NIfTI first.',
    '.nrrd': 'NRRD is not supported. Convert to NIfTI first.',
    '.png': 'A 2D image is not a 3D volume. This model segments 3D volumes only.',
    '.pdf': 'A PDF is a document, not image data. It cannot be segmented.',
  },
  limits: {
    maxFileBytes: 512 * 1024 * 1024,
    maxTotalBytes: 2 * 1024 * 1024 * 1024,
    maxCases: 500,
    stagingTtlSeconds: 21600,
  },
  privacy: [
    'Uploads are processed on the server and are not sent anywhere else.',
    'Uploaded files are held temporarily and are deleted when you delete the dataset.',
    'Never upload identifiable patient data. Use synthetic phantoms or appropriately de-identified, approved research data.',
  ],
};
