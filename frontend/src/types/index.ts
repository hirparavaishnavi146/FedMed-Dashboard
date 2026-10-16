// Shared domain types for the FedMed dashboard.
// Every value shown in the UI is typed here so pages and components agree on shape.

/** Where a piece of data came from. The UI must always tell the user which one it is. */
export type DataSource = 'demo' | 'live';

export type HospitalStatus = 'online' | 'degraded' | 'offline';
export type DatasetStatus = 'ready' | 'partial' | 'not-prepared';
export type LocalTrainingStatus = 'idle' | 'training' | 'complete' | 'failed';

export interface Hospital {
  /** Short identifier used in tables and charts. */
  id: string;
  /** Display name of the simulated research site. */
  name: string;
  /** City / country label. Illustrative only. */
  location: string;
  /** Flower client identity this node connects with. */
  nodeId: string;
  status: HospitalStatus;
  datasetStatus: DatasetStatus;
  /** Number of studies in the local dataset. */
  studies: number;
  /** Local dataset size in gigabytes. */
  sizeGb: number;
  /** ISO timestamp of the last completed synchronisation. */
  lastSync: string;
  localTraining: LocalTrainingStatus;
  /** Federated rounds this node has contributed to. */
  roundsContributed: number;
  /** Remaining differential-privacy budget, epsilon. Zero means exhausted. */
  privacyBudgetUsed: number;
  /** Suggested split when this node's data is used. */
  split: string;
  notes: string;
}

export type RoundStatus = 'complete' | 'running' | 'queued';

export interface TrainingRound {
  round: number;
  status: RoundStatus;
  globalLoss: number;
  globalDice: number;
  globalAccuracy: number;
  /** Hospitals that reported an update for this round. */
  participants: number;
  expectedParticipants: number;
  durationSeconds: number;
  timestamp: string;
}

/** One point on a training-history chart. */
export interface MetricPoint {
  round: number;
  loss: number;
  validationLoss: number;
  dice: number;
  accuracy: number;
}

export type AggregationMethod = 'FedAvg' | 'FedProx' | 'FedAdam';
export type ModelStatus = 'candidate' | 'active' | 'archived';

export interface ModelVersion {
  version: string;
  createdAt: string;
  status: ModelStatus;
  dice: number;
  iou: number;
  accuracy: number;
  loss: number;
  sensitivity: number;
  specificity: number;
  rounds: number;
  notes: string;
}

export interface TrainingConfig {
  rounds: number;
  localEpochs: number;
  learningRate: number;
  batchSize: number;
  aggregation: AggregationMethod;
  minClients: number;
  validationSplit: number;
  randomSeed: number;
  /** Patches per volume - kept small because the reference machine is CPU only. */
  patchSize: number;
  useDifferentialPrivacy: boolean;
  useSecureAggregation: boolean;
  useHomomorphicEncryption: boolean;
}

export type ActivityKind = 'round' | 'client' | 'model' | 'system' | 'privacy';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  hospitalId?: string;
}

export type Severity = 'info' | 'warning' | 'critical';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  severity: Severity;
  category: string;
  message: string;
  source: string;
}

/** Backend health as reported by GET /health. */
export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  demoData: boolean;
  environment: string;
  simulatedTraining: boolean;
  apiPrefix: string;
  time: string;
}

// ---------------------------------------------------------------------------
// API envelope and the Stage 2 endpoint payloads.
// These mirror the Pydantic schemas in backend/app/schemas so the demo data and
// the live API can be swapped without changing a page.
// ---------------------------------------------------------------------------

/** Metadata attached to every /api/v1 response. */
export interface ApiMeta {
  generatedAt: string;
  /** True while the backend returns generated sample values. */
  simulated: boolean;
  source: string;
  notice: string;
}

/** Standard successful API response: payload plus metadata. */
export interface Envelope<T> {
  data: T;
  meta: ApiMeta;
}

/** Standard failure response shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detail: Record<string, unknown>;
  };
}

export interface HospitalSummary {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  totalStudies: number;
  totalSizeGb: number;
  averagePrivacyBudgetUsed: number;
}

/** GET /api/v1/dashboard/metrics */
export interface DashboardMetrics {
  participatingHospitals: number;
  totalHospitals: number;
  hospitalSummary: HospitalSummary;
  federatedRounds: number;
  lastRoundAt: string | null;
  currentModel: ModelVersion | null;
  trainingStatus: string;
  trainingIsSimulated: boolean;
  trainingTrainsModel: boolean;
  trainingExecution: ExecutionMode;
  /** True only when the round figures came from a real run. */
  trainingMeasured: boolean;
  /** The illustrative baseline, kept out of every results field. */
  seededRounds: FederatedRound[];
  totalStudies: number;
  totalSizeGb: number;
  averagePrivacyBudgetUsed: number;
  privacyTargetEpsilon: number;
  metricHistory: MetricPoint[];
  recentRounds: FederatedRound[];
  activity: ActivityEvent[];
  /**
   * Real counts from reports users have actually uploaded.
   *
   * Separate from the federated figures above on purpose: those describe an MRI model
   * that has not been trained, so they are illustrative. These are measured, and zero
   * means nothing has been uploaded yet — not a placeholder.
   */
  reportActivity: ReportActivity;
}

/** What users have actually uploaded, counted from the server's live registry. */
export interface ReportActivity {
  measured: boolean;
  sessions: number;
  samePatientConfirmed: number;
  reportsUploaded: number;
  reportsReadable: number;
  reportsUnreadable: number;
  reportsReadByOcr: number;
  analysesRun: number;
  valuesExtracted: number;
  valuesOutsidePrintedRange: number;
  /** Values whose report printed NO range, so no verdict is possible. */
  valuesWithoutPrintedRange: number;
  documentedDiagnoses: number;
  documentedMedications: number;
  reportsWithRedFlags: number;
  reportTypes: Record<string, number>;
  latestUrgency: string | null;
  note: string;
}

/**
 * How a run was executed. `local-simulation` runs every client in one process,
 * `distributed-local` runs them as separate processes over gRPC, and `cross-silo`
 * is a real deployment across hospital infrastructures - not implemented, and no
 * response may claim it.
 */
export type ExecutionMode = 'local-simulation' | 'distributed-local' | 'cross-silo';

export type TrainingJobState = 'idle' | 'running' | 'completed' | 'stopped' | 'failed';

/** One client's contribution to a round, or why it did not take part. */
export interface FederatedClientResult {
  client: string;
  participated: boolean;
  numExamples: number;
  /** Share of the aggregate this client contributed. Sums to 1 across participants. */
  weight: number;
  trainLoss: number | null;
  validationLoss: number | null;
  validationDice: number | null;
  durationSeconds: number;
  /** Why this client did not contribute, or null when it reported normally. */
  failure: string | null;
}

/**
 * One completed federated round. `measured` is true only when a real run produced
 * this row; seeded placeholder rows carry `measured: false`.
 *
 * Field names are taken from the backend's `FederatedRound` schema, not inferred.
 * In particular there is no `execution` field on a round (it belongs to the run,
 * reported by `/training/status`) and no `failures` count - clients that did not
 * report appear in `excludedClients`.
 */
export interface FederatedRound {
  round: number;
  strategy: string;
  measured: boolean;
  participants: number;
  expectedParticipants: number;
  participatingClients: string[];
  /** Clients that failed or were dropped for this round. */
  excludedClients: FederatedClientResult[];
  clients: FederatedClientResult[];
  totalExamples: number;
  aggregatedLoss: number;
  aggregatedValidationLoss: number | null;
  aggregatedValidationDice: number | null;
  durationSeconds: number;
  startedAt: string;
  finishedAt: string;
  aggregatedParameters: number;
}

/** GET /api/v1/training/history */
export interface FederatedHistory {
  /** `federated-run` when measured, `seed` for the illustrative baseline. */
  source: 'federated-run' | 'seed';
  measured: boolean;
  rounds: FederatedRound[];
  note: string;
}

/** GET /api/v1/training/status */
export interface TrainingStatus {
  runId: string | null;
  status: TrainingJobState;
  execution: ExecutionMode;
  /** True when the numbers came from a real run, false for the seed baseline. */
  measured: boolean;
  /** Always true: every example is synthetic. */
  isSimulatedData: boolean;
  /** Always false: no patient data is involved. */
  trainsOnRealPatientData: boolean;
  strategy: string;
  seed: number;
  config: TrainingConfig | null;
  configDescription: string;
  clients: string[];
  /**
   * Parameter count of the client model. Null when torch is not installed in the
   * deployment (the web service runs without the ML stack). An explicit null, never
   * 0, which would read as a model with no parameters.
   */
  modelParameters: number | null;
  totalRounds: number;
  completedRounds: number;
  currentRound: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  firstLoss: number | null;
  lastLoss: number | null;
  lastValidationDice: number | null;
  lossImprovement: number | null;
  error: string | null;
  message: string;
  history: FederatedRound[];
}

/** GET /api/v1/training/config - what the federation is, and its own limits. */
export interface TrainingConfigResponse {
  strategy: string;
  strategiesSupported: string[];
  executionModes: ExecutionMode[];
  currentExecution: ExecutionMode;
  /** Null when torch is not installed in the deployment. */ 
  model: string | null;
  /** Null when torch is not installed in the deployment. */ 
  modelParameters: number | null;
  /** States plainly that this is not the MRI segmentation model. */
  clientModelDescription: string;
  clientProfiles: { name: string; samples: number; noise: number; description: string }[];
  aggregator: string;
  weighting: string;
  /** What a client uploads. Parameters only. */
  clientsSend: string[];
  /** What a client never uploads. Training examples and labels. */
  clientsNeverSend: string[];
  /** The honest limits, served by the API rather than only documented. */
  limitations: string[];
}

/** GET /api/v1/model/results */
/** One epoch's measured values from a real training run. */
export interface ImagingEpoch {
  epoch: number;
  trainLoss: number;
  validationLoss: number | null;
  validationDice: number | null;
  validationIou: number | null;
  validationSensitivity: number | null;
  validationSpecificity: number | null;
  validationSamples: number;
  durationSeconds: number;
}

/**
 * The measured results of a real 3D U-Net training run, read from the artifact
 * written by `app.imaging.pipeline`.
 *
 * `available: false` means no run has been performed — it does NOT mean zeroes.
 * Rendering a 0.0 Dice for an unrun experiment would state a measured failure.
 */
export interface ImagingExperiment {
  available: boolean;
  source: string | null;
  site: string | null;
  generatedAt: string | null;
  config: Record<string, unknown>;
  configDescription: string | null;
  epochs: ImagingEpoch[];
  epochCount: number;
  firstTrainLoss: number | null;
  lastTrainLoss: number | null;
  lossImproved: boolean | null;
  bestDice: number | null;
  bestEpoch: number | null;
  holdout: {
    dice: number | null;
    loss: number | null;
    iou: number | null;
    cases: number;
    source: string;
  } | null;
  model: {
    architecture: string;
    features: number[];
    parameterCount: number;
    outputIsLogits: boolean;
  } | null;
  provenance: {
    dataSource: string;
    containsPatientData: boolean;
    clinicallyValidated: boolean;
    isDemoValue: boolean;
    splitBy: string;
    note: string;
  } | null;
  durationSeconds: number | null;
  unavailableReason: string | null;
}

export interface ModelResults {
  models: ModelVersion[];
  activeVersion: ModelVersion | null;
  bestVersion: ModelVersion | null;
  latestVersion: ModelVersion | null;
  /** True while `models` holds illustrative values rather than measurements. */
  registryIsIllustrative: boolean;
  registryNotice: string;
  /** Measured results from a real run, kept out of the `models` list entirely. */
  measuredExperiment: ImagingExperiment;
}

export type MechanismState = 'planned' | 'simulated' | 'implemented' | 'unconfigured';

/**
 * How a security feature actually stands in the running process.
 *
 * These are distinct on purpose. `enabled` is NOT the same as "the switch is on":
 * the API reports `enabled` only when a feature is implemented, configured, and in
 * effect. The UI must render these as-is and never infer `enabled` from a toggle.
 */
export type FeatureState =
  | 'enabled'
  | 'disabled'
  | 'unconfigured'
  | 'unverified'
  | 'not_implemented';

export interface SecurityFeature {
  id: string;
  name: string;
  state: FeatureState;
  implemented: boolean;
  enabled: boolean;
  description: string;
  /** What was actually observed — the evidence for the state. */
  evidence: string;
  requirements: string[];
  reference: string;
}

export interface AuthStatus {
  configured: boolean;
  state: FeatureState;
  scheme: string;
  keyCount: number;
  /** Labels and roles only. Never a key, never a hash. */
  principals: { label: string; role: string }[];
  requiredForReads: boolean;
  protectedPaths: string[];
  note: string;
}

export interface TransportStatus {
  configured: boolean;
  state: FeatureState;
  scheme: string;
  certificatePath: string | null;
  certificateValid: boolean | null;
  selfSigned: boolean | null;
  daysRemaining: number | null;
  subject: string | null;
  note: string;
}

export interface SecureAggregationStatus {
  available: boolean;
  configured: boolean;
  state: FeatureState;
  protocol: string;
  primitive: string;
  secretConfigured: boolean;
  toleratesDropout: boolean;
  threatModel: string;
  assumptions: string[];
  note: string;
}

export interface PrivacyAccountingStatus {
  available: boolean;
  configured: boolean;
  state: FeatureState;
  mechanism: string;
  accountant: string;
  /** null until DP is configured. Never 0, which would read as "perfect privacy". */
  epsilon: number | null;
  delta: number | null;
  noiseMultiplier: number | null;
  clippingNorm: number | null;
  sampleRate: number | null;
  rounds: number | null;
  withinBudget: boolean | null;
  privacyUnit: string;
  assumptions: string[];
  note: string;
}

export interface AuditSummary {
  total: number;
  info: number;
  warning: number;
  critical: number;
  recorded: boolean;
  note: string;
}

export interface PrivacyAccountResult {
  epsilon: number | null;
  delta: number | null;
  steps: number;
  targetEpsilon: number | null;
  withinBudget: boolean | null;
  accountant: string;
  mechanism: string;
  available: boolean;
  unavailableReason: string | null;
  privacyUnit: string;
  config: Record<string, unknown>;
  configDescription: string;
  assumptions: string[];
}

export interface PrivacyMechanism {
  id: string;
  name: string;
  description: string;
  state: MechanismState;
  /** True when code exists in this repository. Not a claim that it is active. */
  implemented: boolean;
  reference: string;
}

export interface PrivacyBudget {
  hospitalId: string;
  hospital: string;
  epsilon: number;
  targetEpsilon: number;
  exceeded: boolean;
}

export interface DifferentialPrivacyConfig {
  mechanism: string;
  noiseMultiplier: number;
  clippingNorm: number;
  targetEpsilon: number;
  /** False: the configuration is not applied to anything. */
  applied: boolean;
}

export interface EncryptionStatus {
  transport: string;
  atRest: string;
  note: string;
}

/** GET /api/v1/security/status */
export interface SecurityStatus {
  mechanismsImplemented: number;
  mechanismsTotal: number;
  encryption: EncryptionStatus;
  differentialPrivacy: DifferentialPrivacyConfig;
  secureAggregationEnabled: boolean;
  homomorphicEncryptionEnabled: boolean;
  mechanisms: PrivacyMechanism[];
  budgets: PrivacyBudget[];
  events: SecurityEvent[];

  // --- Stage 5: the real, measured posture -------------------------------
  /** Each feature with the evidence for its state. */
  features: SecurityFeature[];
  authentication: AuthStatus | null;
  transport: TransportStatus | null;
  secureAggregation: SecureAggregationStatus | null;
  privacyAccounting: PrivacyAccountingStatus | null;
  audit: AuditSummary | null;
  /** Plain statements of what remains unverified or unimplemented. */
  disclaimers: string[];
}

// ---------------------------------------------------------------------------
// Dataset management (the MRI dataset workflow)
//
// Every field here mirrors app/schemas/datasets.py. The distinction that matters:
// `readyToTrain` requires the dataset to be BOTH validated and assigned, and
// `measured` on a job is true only when the training loop really ran.
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning';
export type DatasetSource = 'server-directory' | 'upload';

export interface DatasetIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  case: string | null;
}

export interface DatasetCase {
  name: string;
  imagePath: string;
  labelPath: string | null;
  imageShape: number[] | null;
  labelShape: number[] | null;
  spacing: number[] | null;
  voxels: number | null;
  foregroundVoxels: number | null;
  foregroundFraction: number | null;
  labelValues: number[];
  valid: boolean;
  issues: DatasetIssue[];
}

export interface ValidationLimits {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxCases: number;
  minVoxels: number;
  maxVoxels: number;
  acceptedSuffixes: string[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  source: DatasetSource;
  path: string;
  valid: boolean;
  caseCount: number;
  validCaseCount: number;
  errorCount: number;
  warningCount: number;
  totalBytes: number;
  modality: string;
  modalitySource: string;
  createdAt: string;
  issues: DatasetIssue[];
  cases: DatasetCase[];
  limits: ValidationLimits;
  assignedHospitalId: string | null;
  assignedHospitalName: string | null;
  assignedAt: string | null;
  readyToTrain: boolean;
}

export interface DatasetFormats {
  formats: string[];
  formatNotes: Record<string, string>;
  folderStructure: string[];
  rules: string[];
  notAccepted: Record<string, string>;
  limits: {
    maxFileBytes: number;
    maxTotalBytes: number;
    maxCases: number;
    stagingTtlSeconds: number;
  };
  privacy: string[];
}

export interface DatasetDeleteResult {
  id: string;
  deleted: boolean;
  filesRemoved: number;
  detail: string;
}

export type TrainingJobStateName =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface ImagingJobConfig {
  epochs: number;
  learningRate: number;
  seed: number;
  validationFraction: number;
  targetShape: number[];
  features: number[];
  labelThreshold: number;
}

export interface ImagingEpochResult {
  epoch: number;
  trainLoss: number;
  validationLoss: number | null;
  validationDice: number | null;
  validationIou: number | null;
  durationSeconds: number;
}

export interface ImagingJobStatus {
  state: TrainingJobStateName;
  jobId: string | null;
  datasetId: string | null;
  datasetName: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
  config: ImagingJobConfig | null;
  epochsTotal: number;
  epochsCompleted: number;
  currentEpoch: number | null;
  trainLoss: number | null;
  firstTrainLoss: number | null;
  bestValidationDice: number | null;
  bestEpoch: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  epochs: ImagingEpochResult[];
  checkpointDir: string | null;
  error: string | null;
  message: string;
  measured: boolean;
  execution: string;
  trainsOnRealPatientData: boolean;
  /** False when this deployment has no torch, so training cannot run here. */
  available: boolean;
  unavailableReason: string | null;
}

// ---------------------------------------------------------------------------
// Case intake (mixed uploads: MRI volumes, reports, 2D images)
//
// Mirrors app/schemas/cases.py. The important field is `interpretationSupported`,
// which is false for every case: this project cannot read a 2D X-ray or a written
// report, and its only model has seen nothing but synthetic phantoms. The UI must
// render that rather than implying an interpretation.
// ---------------------------------------------------------------------------

export interface CaseCapabilityEntry {
  accepted: string[];
  note: string;
  [key: string]: unknown;
}

export interface CaseCapabilities {
  mriVolume: CaseCapabilityEntry;
  reportPdf: CaseCapabilityEntry;
  reportText: CaseCapabilityEntry;
  image2d: CaseCapabilityEntry;
  dicom: CaseCapabilityEntry;
}

export interface CaseReportSection {
  heading: string;
  text: string;
}

export interface CaseFileAnalysis {
  status?: string;
  characters?: number;
  pages?: number | null;
  headingsFound?: string[];
  sections?: CaseReportSection[];
  excerpt?: string;
  note?: string;
  reason?: string;
  interpretationSupported?: boolean;
  // MRI
  validation?: Record<string, unknown>;
  segmentation?: Record<string, unknown>;
  // 2D image
  width?: number;
  height?: number;
  mode?: string;
  format?: string | null;
}

export interface CaseFile {
  name: string;
  kind: string;
  sizeBytes: number;
  method: string;
  note: string;
  analysed: boolean;
  analysis: CaseFileAnalysis;
}

export interface CaseSummary {
  caseId: string;
  name: string;
  createdAt: string;
  fileCount: number;
  analysedCount: number;
  mriVolumeCount: number;
  maskCount: number;
  reportCount: number;
  image2dCount: number;
  files: CaseFile[];
  interpretationSupported: boolean;
  interpretationReason: string;
  notice: string;
  reasons: string[];
  capabilities: Record<string, CaseCapabilityEntry>;
  staged: boolean;
}

// ---------------------------------------------------------------------------
// Medical report analysis (clinical decision support)
//
// Mirrors app/schemas/medical_reports.py. The split that matters: `findings` and
// `comparison` are computed from the report text, while `possibleComplications`,
// `clinicalSuggestions` and the AI narrative are model-generated and each carry
// their own `available` flag. Never render a generated section as if it were a
// measured fact.
//
// `urgency.emergencyNotice` must be shown BEFORE the rest of the analysis when
// `urgency.showBeforeAnalysis` is true.
// ---------------------------------------------------------------------------

export interface Provenance {
  reportId: string;
  reportName: string;
  page: number | null;
  line: number | null;
  snippet: string;
}

export interface ExtractedLabValue {
  name: string;
  value: number | null;
  valueText: string;
  unit: string | null;
  referenceText: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  reportedFlag: string | null;
  withinRange: boolean | null;
  note: string;
  provenance: Provenance;
}

export interface ParsedReport {
  reportId: string;
  name: string;
  reportType: string | null;
  reportTypeEvidence: string | null;
  dates: {
    literal: string;
    iso: string | null;
    ambiguous: boolean;
    note: string;
    provenance: Provenance;
  }[];
  labs: ExtractedLabValue[];
  diagnoses: { heading: string; text: string; provenance: Provenance }[];
  medications: { heading: string; text: string; provenance: Provenance }[];
  history: { heading: string; text: string; provenance: Provenance }[];
  impressions: { heading: string; text: string; provenance: Provenance }[];
  redFlags: { term: string; provenance: Provenance }[];
  pageCount: number;
  characters: number;
}

export interface MedicalReport {
  reportId: string;
  name: string;
  sizeBytes: number;
  contentType: string | null;
  status: string;
  pages: number | null;
  characters: number;
  headingsFound: string[];
  ocrUsed: boolean;
  extractNote: string;
  pageTexts: string[];
}

export interface ReportSession {
  sessionId: string;
  createdAt: string;
  reportCount: number;
  samePatientConfirmed: boolean;
  reports: MedicalReport[];
  analysisIds: string[];
}

export interface ReportUploadResult {
  sessionId: string;
  accepted: {
    reportId: string;
    name: string;
    status: string;
    pages: number | null;
    characters: number;
    ocrUsed: boolean;
  }[];
  rejected: { name: string; reason: string }[];
  reportCount: number;
  maxReports: number;
  note: string;
}

export interface MedicalFinding {
  finding: string;
  kind: string;
  reportName: string;
  reportDate: string | null;
  page: number | null;
  referenceRange: string | null;
  direction: string | null;
  documentedOrInferred: string;
  whyItMayMatter: string;
  sourceSnippet: string;
}

export interface MedicalComparison {
  reportsCompared: string[];
  consistentFindings: Record<string, unknown>[];
  differingFindings: Record<string, unknown>[];
  findingsInOneReportOnly: Record<string, unknown>[];
  missingInformation: string[];
  note: string;
}

export interface MedicalUrgency {
  category: 'emergency' | 'prompt-review' | 'routine-review' | 'unable-to-assess';
  basis: string;
  emergencyNotice: string | null;
  showBeforeAnalysis: boolean;
  redFlags: { term: string; provenance: Provenance }[];
  aiSuggestedUrgencies: string[];
  limitation: string;
  categoriesExplained: Record<string, string>;
}

export interface MedicalAnalysis {
  analysisId: string;
  sessionId: string;
  createdAt: string;
  reportCount: number;
  reports: MedicalReport[];
  safetyDisclaimer: string;
  urgency: MedicalUrgency;
  ai: {
    available: boolean;
    data: Record<string, unknown>;
    citationsRejected?: string[];
    absoluteClaimWarnings?: string[];
    note?: string;
    reason?: string | null;
  };
  summary: {
    deterministicDigest: {
      reportName: string;
      reportType: string;
      reportDate: string | null;
      pages: number | null;
      status: string;
      valuesFound: number;
      valuesOutsidePrintedRange: number;
      headingsFound: string[];
      note: string;
    }[];
    note: string;
  };
  findings: MedicalFinding[];
  comparison: MedicalComparison;
  diagnosisStatus: {
    status: string;
    explanation: string;
    documentedDiagnoses: { reportName: string; heading: string; text: string; page: number | null }[];
    possibleConditionRequiringEvaluation: unknown;
    possibleConditionNote: string;
  };
  clinicalSuggestions: {
    available: boolean;
    reason: string | null;
    items: Record<string, unknown>[];
    note: string;
  };
  possibleComplications: {
    available: boolean;
    reason: string | null;
    items: Record<string, unknown>[];
    note: string;
  };
  doctorReadySummary: {
    available: boolean;
    reason: string | null;
    ai: Record<string, unknown> | null;
    assembledForClinician: Record<string, unknown>;
  };
}

export interface MedicalReportHealth {
  available: boolean;
  ai: { configured: boolean; provider: string | null; model: string | null; reason: string | null };
  ocr: {
    availableForImages: boolean;
    availableForPdfs: boolean;
    engineInstalled: boolean;
    engineDetail: string;
    reason: string | null;
    installHint: string;
  };
  maxReports: number;
  maxFileBytes: number;
  acceptedTypes: string[];
  authRequired: boolean;
  note: string;
  /**
   * True when the server was deliberately configured to serve these routes to
   * anonymous callers (FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO). When true the page must
   * say so prominently — an anonymous visitor is being allowed to upload, and that is
   * a property of the deployment, not of this feature.
   */
  publicDemoMode: boolean;
  publicDemoWarning: string | null;
}
