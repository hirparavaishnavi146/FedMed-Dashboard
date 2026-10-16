// Datasets page - the MRI dataset workflow.
//
// What this page does:
//   1. shows the expected folder structure and accepted formats, read from the API
//      so the guidance cannot drift from the validator;
//   2. validates a dataset, either a directory already on the server or files
//      uploaded through the browser;
//   3. shows a summary: case counts, geometry, label values, every validation error;
//   4. assigns a validated dataset to a simulated hospital client;
//   5. starts a REAL 3D U-Net training job and reports state, completed epochs,
//      measured loss and Dice, and any error.
//
// What it does not do:
//   it never shows a training run as successful unless the backend reports
//   `measured: true`, and it never claims a dataset is ready merely because it was
//   uploaded. `readyToTrain` requires the dataset to be both validated AND assigned.
//
// The model is a research prototype. Nothing here is clinically validated, and no
// real patient data is used.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, StatList } from '../components/Card';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { api, ApiError, IS_DEMO_MODE } from '../services/api';
import { DEMO_DATASET_CLIENTS, DEMO_DATASET_FORMATS, DEMO_DATASETS } from '../data/demo';
import type {
  DatasetFormats,
  DatasetSummary,
  ImagingJobConfig,
  ImagingJobStatus,
} from '../types';

const EMPTY_FORMATS: DatasetFormats = {
  formats: [],
  formatNotes: {},
  folderStructure: [],
  rules: [],
  notAccepted: {},
  limits: { maxFileBytes: 0, maxTotalBytes: 0, maxCases: 0, stagingTtlSeconds: 0 },
  privacy: [],
};

const EMPTY_JOB: ImagingJobStatus = {
  state: 'idle',
  jobId: null,
  datasetId: null,
  datasetName: null,
  hospitalId: null,
  hospitalName: null,
  config: null,
  epochsTotal: 0,
  epochsCompleted: 0,
  currentEpoch: null,
  trainLoss: null,
  firstTrainLoss: null,
  bestValidationDice: null,
  bestEpoch: null,
  startedAt: null,
  finishedAt: null,
  durationSeconds: null,
  epochs: [],
  checkpointDir: null,
  error: null,
  message: '',
  measured: false,
  execution: 'local-cpu',
  trainsOnRealPatientData: false,
  available: true,
  unavailableReason: null,
};

const DEFAULT_CONFIG: ImagingJobConfig = {
  epochs: 3,
  learningRate: 0.001,
  seed: 42,
  validationFraction: 0.25,
  targetShape: [32, 32, 32],
  features: [8, 16, 32],
  labelThreshold: 0.5,
};

function jobBadge(state: ImagingJobStatus['state']): {
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  label: string;
} {
  switch (state) {
    case 'running':
      return { tone: 'info', label: 'TRAINING' };
    case 'completed':
      return { tone: 'success', label: 'COMPLETED' };
    case 'failed':
      return { tone: 'danger', label: 'FAILED' };
    case 'stopped':
      return { tone: 'warning', label: 'STOPPED' };
    default:
      return { tone: 'neutral', label: 'IDLE' };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function DatasetsPage(): React.JSX.Element {
  const [tab, setTab] = useState<'prepare' | 'datasets' | 'training'>('datasets');

  const [formats, setFormats] = useState<DatasetFormats>(EMPTY_FORMATS);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [job, setJob] = useState<ImagingJobStatus>(EMPTY_JOB);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [directoryPath, setDirectoryPath] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<ImagingJobConfig>(DEFAULT_CONFIG);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pollTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    // Demo mode has no backend, so there is nothing to validate or train. Firing
    // the requests anyway would return 404 from the static host and present a
    // broken page, so the labelled sample rows are shown instead.
    if (IS_DEMO_MODE) {
      setDatasets(DEMO_DATASETS);
      setClients(DEMO_DATASET_CLIENTS);
      setFormats(DEMO_DATASET_FORMATS);
      setJob(EMPTY_JOB);
      setLoading(false);
      return;
    }
    try {
      const [formatsResult, list, clientList, jobStatus] = await Promise.all([
        api.datasetFormats(),
        api.datasets(),
        api.datasetClients(),
        api.imagingTrainingStatus(),
      ]);
      setFormats(formatsResult);
      setDatasets(list.datasets);
      setClients(clientList);
      setJob(jobStatus);
      setError(null);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while a job runs, so completed epochs and loss appear as they happen.
  useEffect(() => {
    if (job.state !== 'running') {
      if (pollTimer.current !== null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    pollTimer.current = window.setInterval(() => {
      api
        .imagingTrainingStatus()
        .then(setJob)
        .catch(() => undefined);
    }, 1500);
    return () => {
      if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
    };
  }, [job.state]);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    setActionNote(null);
    try {
      await action();
    } catch (caught) {
      setActionError(readableError(caught));
    } finally {
      setBusy(null);
    }
  };

  const onValidateDirectory = () =>
    run('validate', async () => {
      if (!directoryPath.trim()) return;
      const result = await api.validateDatasetDirectory(directoryPath.trim(), datasetName.trim() || undefined);
      await refresh();
      setActionNote(
        result.valid
          ? `Validated ${result.caseCount} case(s). Assign it to a hospital client to enable training.`
          : `Validation failed with ${result.errorCount} error(s). See the report below.`,
      );
    });

  const onUpload = (files: FileList | null) =>
    run('upload', async () => {
      if (!files || files.length === 0) return;
      const result = await api.uploadDataset(Array.from(files), datasetName.trim() || undefined);
      await refresh();
      setActionNote(
        result.valid
          ? `Uploaded and validated ${result.caseCount} case(s).`
          : `Uploaded, but validation found ${result.errorCount} error(s).`,
      );
      if (fileInput.current) fileInput.current.value = '';
    });

  const onAssign = (datasetId: string) =>
    run(`assign-${datasetId}`, async () => {
      const hospitalId = assignTarget[datasetId];
      if (!hospitalId) {
        setActionError('Choose a hospital client first.');
        return;
      }
      await api.assignDataset(datasetId, hospitalId);
      await refresh();
      setActionNote('Dataset assigned. Training is now enabled for it.');
    });

  const onDelete = (datasetId: string) =>
    run(`delete-${datasetId}`, async () => {
      const result = await api.deleteDataset(datasetId);
      await refresh();
      setActionNote(result.detail);
    });

  const onStartTraining = (datasetId: string) =>
    run('train', async () => {
      const status = await api.startImagingTraining(datasetId, config);
      setJob(status);
      setTab('training');
    });

  const onStopTraining = () =>
    run('stop', async () => {
      setJob(await api.stopImagingTraining());
    });

  const onResetJob = () =>
    run('reset', async () => {
      setJob(await api.resetImagingTraining());
    });

  if (loading) return <LoadingState label="Loading datasets" />;
  if (error) {
    return (
      <div className="page">
        <PageHeader title="Datasets" description="MRI dataset workflow." />
        <ErrorState
          message="Could not load dataset information"
          hint={error}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const ready = datasets.filter((dataset) => dataset.readyToTrain);
  const running = job.state === 'running';

  return (
    <div className="page">
      <PageHeader
        title="Datasets"
        description="Validate approved research MRI data, assign it to a simulated hospital client, and train the 3D U-Net on it."
        action={
          // Reflects the job's real state. Showing a flat "IDLE" after a run
          // finished would hide the outcome of the run that just happened.
          <StatusBadge tone={jobBadge(job.state).tone}>{jobBadge(job.state).label}</StatusBadge>
        }
      />

      {IS_DEMO_MODE ? (
        <Notice tone="warning" title="Demo mode — sample data, no backend" icon="warning">
          The dashboard is rendering labelled sample data and is not calling an API, so
          validation, assignment and training cannot run and their buttons are disabled.
          The sample rows below illustrate both a passing and a failing validation. Set{' '}
          <code>VITE_USE_DEMO_DATA=false</code> with a running backend to use the real
          workflow.
        </Notice>
      ) : null}

      {!job.available && job.unavailableReason ? (
        <Notice tone="warning" title="Training cannot run in this deployment" icon="warning">
          {job.unavailableReason}
        </Notice>
      ) : null}

      <div className="metrics metrics--4">
        <MetricCard
          label="Datasets"
          value={String(datasets.length)}
          icon="database"
          footnote={`${ready.length} validated and assigned.`}
        />
        <MetricCard
          label="Cases"
          value={String(datasets.reduce((total, item) => total + item.caseCount, 0))}
          icon="activity"
          footnote="Image/mask pairs across every dataset."
        />
        <MetricCard
          label="Validation errors"
          value={String(datasets.reduce((total, item) => total + item.errorCount, 0))}
          icon="warning"
          footnote="A dataset with any error cannot be assigned or trained on."
        />
        <MetricCard
          label="Model"
          value="3D U-Net"
          icon="model"
          footnote={
            job.measured && job.bestValidationDice !== null
              ? `Best measured Dice ${job.bestValidationDice.toFixed(4)}.`
              : '350,809 parameters. No completed run on this process yet.'
          }
        />
      </div>

      <Tabs
        idPrefix="dataset"
        active={tab}
        onChange={(next) => setTab(next as typeof tab)}
        items={[
          { id: 'datasets', label: 'Datasets & assignment' },
          { id: 'prepare', label: 'Preparing data' },
          { id: 'training', label: 'Training' },
        ]}
      />

      {/* ---------------------------------------------------------------- */}
      {tab === 'datasets' ? (
        <TabPanel idPrefix="dataset" id="datasets">
          <Card>
            <CardHeader
              title="Validate a dataset"
              subtitle="Either a directory already on the server, or files uploaded from this browser. Both use the same validator."
            />

            <div className="form-grid">
              <label className="field">
                <span className="field__label">Server directory path</span>
                <input
                  className="field__input"
                  type="text"
                  value={directoryPath}
                  placeholder="D:\datasets\mri-segmentation"
                  onChange={(event) => setDirectoryPath(event.target.value)}
                />
                <span className="field__hint">
                  Read only. Nothing on that path is modified or deleted.
                </span>
              </label>
              <label className="field">
                <span className="field__label">Dataset name (optional)</span>
                <input
                  className="field__input"
                  type="text"
                  value={datasetName}
                  placeholder="Example: prostate-T2-deidentified"
                  onChange={(event) => setDatasetName(event.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <Button
                variant="primary"
                icon="check"
                disabled={busy !== null || IS_DEMO_MODE || !directoryPath.trim()}
                onClick={() => void onValidateDirectory()}
              >
                {busy === 'validate' ? 'Validating...' : 'Validate directory'}
              </Button>
              <input
                ref={fileInput}
                id="dataset-upload"
                type="file"
                multiple
                className="visually-hidden"
                onChange={(event) => void onUpload(event.target.files)}
              />
              <Button
                icon="database"
                disabled={busy !== null || IS_DEMO_MODE}
                onClick={() => fileInput.current?.click()}
              >
                {busy === 'upload' ? 'Uploading...' : 'Upload NIfTI files'}
              </Button>
              <Button icon="refresh" disabled={busy !== null} onClick={() => void refresh()}>
                Refresh
              </Button>
            </div>

            {actionError ? (
              <Notice tone="warning" title="That did not work" icon="warning">
                {actionError}
              </Notice>
            ) : null}
            {actionNote ? (
              <Notice tone="info" title="Done" icon="info">
                {actionNote}
              </Notice>
            ) : null}
          </Card>

          {datasets.length === 0 ? (
            <Card>
              <CardHeader title="No datasets yet" subtitle="Validate a directory or upload files to begin." />
              <p className="card__footnote">
                The expected structure is on the <strong>Preparing data</strong> tab, and
                is served by the API so it always matches what the validator enforces.
              </p>
            </Card>
          ) : null}

          {datasets.map((dataset) => (
            <Card key={dataset.id}>
              <CardHeader
                title={dataset.name}
                subtitle={`${dataset.source === 'upload' ? 'Uploaded' : 'Server directory'} · ${dataset.caseCount} case(s) · ${formatBytes(dataset.totalBytes)}`}
                action={
                  dataset.valid ? (
                    <StatusBadge tone="success">VALID</StatusBadge>
                  ) : (
                    <StatusBadge tone="danger">
                      {dataset.errorCount} ERROR{dataset.errorCount === 1 ? '' : 'S'}
                    </StatusBadge>
                  )
                }
              />

              <StatList
                items={[
                  { label: 'Cases', value: `${dataset.validCaseCount} of ${dataset.caseCount} valid` },
                  { label: 'Warnings', value: String(dataset.warningCount) },
                  { label: 'Modality', value: dataset.modality },
                  { label: 'Path', value: dataset.path },
                  {
                    label: 'Assigned client',
                    value: dataset.assignedHospitalName ?? 'Not assigned',
                  },
                  {
                    label: 'Ready to train',
                    value: dataset.readyToTrain ? 'Yes' : 'No',
                  },
                ]}
              />

              <p className="card__footnote">{dataset.modalitySource}</p>

              {/* Errors first, with the case they belong to. */}
              {dataset.issues.length > 0 || dataset.errorCount + dataset.warningCount > 0 ? (
                <div className="issue-list">
                  {dataset.issues.map((issue, index) => (
                    <div className="issue issue--error" key={`ds-${index}`}>
                      <Icon name="warning" size={16} />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                  {dataset.cases
                    .filter((item) => item.issues.length > 0)
                    .slice(0, 25)
                    .map((item) =>
                      item.issues.map((issue, index) => (
                        <div
                          className={`issue issue--${issue.severity}`}
                          key={`${item.name}-${index}`}
                        >
                          <Icon name={issue.severity === 'error' ? 'warning' : 'info'} size={16} />
                          <span>
                            <strong>{item.name}</strong> — {issue.message}
                          </span>
                        </div>
                      )),
                    )}
                  {dataset.cases.filter((item) => item.issues.length > 0).length > 25 ? (
                    <p className="card__footnote">
                      Showing the first 25 cases with findings.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Per-case geometry, so a mismatch is visible rather than buried. */}
              {dataset.cases.length > 0 ? (
                <details className="card__details">
                  <summary className="card__details-summary">
                    Per-case detail ({dataset.cases.length})
                  </summary>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Case</th>
                          <th>Image shape</th>
                          <th>Mask shape</th>
                          <th>Label values</th>
                          <th>Foreground</th>
                          <th>Valid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.cases.slice(0, 50).map((item) => (
                          <tr key={item.name}>
                            <td>{item.name}</td>
                            <td>{item.imageShape ? item.imageShape.join(' x ') : '-'}</td>
                            <td>{item.labelShape ? item.labelShape.join(' x ') : '-'}</td>
                            <td>{item.labelValues.length ? item.labelValues.join(', ') : '-'}</td>
                            <td>
                              {item.foregroundFraction === null
                                ? '-'
                                : `${(item.foregroundFraction * 100).toFixed(1)}%`}
                            </td>
                            <td>{item.valid ? 'yes' : 'no'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}

              <div className="form-actions">
                <label className="field">
                  <span className="field__label">Assign to</span>
                  <select
                    className="field__input"
                    value={assignTarget[dataset.id] ?? ''}
                    onChange={(event) =>
                      setAssignTarget({ ...assignTarget, [dataset.id]: event.target.value })
                    }
                  >
                    <option value="">Choose a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.id} — {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  icon="hospital"
                  variant="primary"
                  disabled={busy !== null || IS_DEMO_MODE || !dataset.valid || !assignTarget[dataset.id]}
                  onClick={() => void onAssign(dataset.id)}
                  title={!dataset.valid ? 'Fix the validation errors before assigning.' : undefined}
                >
                  {busy === `assign-${dataset.id}` ? 'Assigning...' : 'Assign'}
                </Button>
                <Button
                  icon="play"
                  disabled={busy !== null || IS_DEMO_MODE || !dataset.readyToTrain || running || !job.available}
                  onClick={() => void onStartTraining(dataset.id)}
                  title={
                    !dataset.valid
                      ? 'This dataset did not pass validation.'
                      : !dataset.assignedHospitalId
                        ? 'Assign the dataset to a hospital client first.'
                        : running
                          ? 'A training job is already running.'
                          : !job.available
                            ? 'This deployment has no torch, so training cannot run here.'
                            : undefined
                  }
                >
                  Start training
                </Button>
                <Button
                  icon="close"
                  variant="danger"
                  disabled={busy !== null || IS_DEMO_MODE || running}
                  onClick={() => void onDelete(dataset.id)}
                  title={running ? 'Stop the running job before deleting.' : undefined}
                >
                  {busy === `delete-${dataset.id}` ? 'Removing...' : 'Remove'}
                </Button>
              </div>

              {!dataset.valid ? (
                <p className="card__footnote">
                  Assignment and training are disabled until every error above is fixed.
                </p>
              ) : !dataset.assignedHospitalId ? (
                <p className="card__footnote">
                  Valid, but not yet assigned — so it is not ready to train.
                </p>
              ) : null}
            </Card>
          ))}
        </TabPanel>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {tab === 'prepare' ? (
        <TabPanel idPrefix="dataset" id="prepare">
          <Card>
            <CardHeader
              title="Expected folder structure"
              subtitle="Served by the API, so it cannot drift from what the validator enforces."
            />
            <pre className="code-block">
              {formats.folderStructure.length
                ? formats.folderStructure.join('\n')
                : 'Loading...'}
            </pre>
            <p className="card__footnote">
              Accepted file types:{' '}
              {formats.formats.length ? formats.formats.join(', ') : 'loading'}
            </p>
            {Object.entries(formats.formatNotes).map(([suffix, note]) => (
              <p className="card__footnote" key={suffix}>
                <code>{suffix}</code> — {note}
              </p>
            ))}
          </Card>

          <Card>
            <CardHeader title="Rules the validator enforces" subtitle="A dataset is rejected when any rule is broken." />
            <ul className="notice__list">
              {formats.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Card>

          <div className="grid grid--sidebar">
            <Card>
              <CardHeader
                title="Inputs that are refused"
                subtitle="These are not interchangeable with 3D MRI volumes."
              />
              <ul className="notice__list">
                {Object.entries(formats.notAccepted).map(([suffix, reason]) => (
                  <li key={suffix}>
                    <code>{suffix}</code> — {reason}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Limits and handling" subtitle="Where files go, and for how long." />
              <StatList
                items={[
                  { label: 'Max file size', value: formatBytes(formats.limits.maxFileBytes) },
                  { label: 'Max dataset size', value: formatBytes(formats.limits.maxTotalBytes) },
                  { label: 'Max cases', value: String(formats.limits.maxCases) },
                  {
                    label: 'Uploads expire after',
                    value: `${Math.round(formats.limits.stagingTtlSeconds / 3600)} hours`,
                  },
                ]}
              />
              <ul className="notice__list">
                {formats.privacy.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="How a local training run reaches this dashboard"
              subtitle="Training is not run on the public instance, and this is what connects the two."
            />
            <pre className="code-block">{`cd backend

# 1. Validate locally (same validator as this page)
..\\.venv\\Scripts\\python.exe -m app.imaging.pipeline \\
    --data-dir D:\\datasets\\mri-segmentation --epochs 4 --seed 42

# 2. The run writes measured results here:
#    backend\\experiments\\imaging\\experiment.json

# 3. Point the deployed API at that file:
#    FEDMED_IMAGING_EXPERIMENT=C:\\path\\to\\experiment.json
#    then GET /api/v1/model/experiment serves those real numbers.`}</pre>
            <p className="card__footnote">
              3D MRI training needs about 384 MB with torch loaded, and the free hosting
              tier has 512 MB in total, so the API and a training run cannot share one
              instance. Checkpoints never leave the machine that trained them.
            </p>
          </Card>
        </TabPanel>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {tab === 'training' ? (
        <TabPanel idPrefix="dataset" id="training">
          <Card>
            <CardHeader
              title="Training configuration"
              subtitle="These parameters reach the real training loop. There are no fields for options this model does not have."
            />
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Epochs</span>
                <input
                  className="field__input"
                  type="number"
                  min={1}
                  max={20}
                  value={config.epochs}
                  onChange={(event) =>
                    setConfig({ ...config, epochs: Number(event.target.value) })
                  }
                />
                <span className="field__hint">1&ndash;20. Each epoch trains on every case once.</span>
              </label>
              <label className="field">
                <span className="field__label">Learning rate</span>
                <input
                  className="field__input"
                  type="number"
                  step="0.0001"
                  min={0.00001}
                  max={0.1}
                  value={config.learningRate}
                  onChange={(event) =>
                    setConfig({ ...config, learningRate: Number(event.target.value) })
                  }
                />
                <span className="field__hint">0.00001&ndash;0.1. SGD over the U-Net.</span>
              </label>
              <label className="field">
                <span className="field__label">Seed</span>
                <input
                  className="field__input"
                  type="number"
                  value={config.seed}
                  onChange={(event) => setConfig({ ...config, seed: Number(event.target.value) })}
                />
                <span className="field__hint">The same seed reproduces the run.</span>
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Validation split</span>
                <input
                  className="field__input"
                  type="number"
                  step="0.05"
                  min={0.1}
                  max={0.5}
                  value={config.validationFraction}
                  onChange={(event) =>
                    setConfig({ ...config, validationFraction: Number(event.target.value) })
                  }
                />
                <span className="field__hint">Fraction of cases held back, split by case.</span>
              </label>
              <label className="field">
                <span className="field__label">Input shape (D x H x W)</span>
                <input
                  className="field__input"
                  type="text"
                  value={config.targetShape.join(' x ')}
                  onChange={(event) => {
                    const parts = event.target.value
                      .split(/[x,\s]+/)
                      .filter(Boolean)
                      .map(Number);
                    if (parts.length === 3 && parts.every((value) => Number.isFinite(value))) {
                      setConfig({ ...config, targetShape: parts });
                    }
                  }}
                />
                <span className="field__hint">
                  Each axis must divide by 8, because the network downsamples 3 times.
                </span>
              </label>
              <label className="field">
                <span className="field__label">Features</span>
                <input
                  className="field__input"
                  type="text"
                  value={config.features.join(', ')}
                  onChange={(event) => {
                    const parts = event.target.value
                      .split(/[,\s]+/)
                      .filter(Boolean)
                      .map(Number);
                    if (parts.length > 0 && parts.every((value) => Number.isFinite(value))) {
                      setConfig({ ...config, features: parts });
                    }
                  }}
                />
                <span className="field__hint">
                  Filter counts per U-Net stage. Default 8, 16, 32.
                </span>
              </label>
            </div>
            <p className="card__footnote">
              Batch size is fixed at 1: a 3D volume is too large for more on CPU. That is
              why the field is absent rather than present and ignored.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Training job"
              subtitle="Started from the dataset card, or with the button below after choosing a ready dataset."
              action={
                job.state === 'running' ? (
                  <StatusBadge tone="info">RUNNING</StatusBadge>
                ) : job.state === 'completed' ? (
                  <StatusBadge tone="success">COMPLETED</StatusBadge>
                ) : job.state === 'failed' ? (
                  <StatusBadge tone="danger">FAILED</StatusBadge>
                ) : job.state === 'stopped' ? (
                  <StatusBadge tone="warning">STOPPED</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">IDLE</StatusBadge>
                )
              }
            />

            {job.state === 'idle' ? (
              <p className="card__footnote">
                No job has run in this process. Choose a dataset on the first tab and
                press Start training.
              </p>
            ) : null}

            {job.error ? (
              <Notice tone="warning" title="Training failed" icon="warning">
                {job.error}
              </Notice>
            ) : null}

            {job.message ? <p className="card__footnote">{job.message}</p> : null}

            {job.datasetName ? (
              <>
                <div className="metrics metrics--4">
                  <MetricCard
                    label="Epochs"
                    value={`${job.epochsCompleted}`}
                    unit={`of ${job.epochsTotal}`}
                    icon="training"
                    footnote={job.bestEpoch ? `Best Dice at epoch ${job.bestEpoch}.` : 'In progress.'}
                  />
                  <MetricCard
                    label="Training loss"
                    value={job.trainLoss === null ? 'not measured' : job.trainLoss.toFixed(4)}
                    icon="activity"
                    footnote={
                      job.firstTrainLoss !== null && job.trainLoss !== null
                        ? `From ${job.firstTrainLoss.toFixed(4)} to ${job.trainLoss.toFixed(4)}.`
                        : 'Reported by the loop, never estimated.'
                    }
                  />
                  <MetricCard
                    label="Best validation Dice"
                    value={
                      job.bestValidationDice === null
                        ? 'not measured'
                        : job.bestValidationDice.toFixed(4)
                    }
                    icon="model"
                    footnote="Held-back split, scored from real predictions."
                  />
                  <MetricCard
                    label="Client"
                    value={job.hospitalId ?? '-'}
                    icon="hospital"
                    footnote={job.hospitalName ?? 'Not assigned.'}
                  />
                </div>

                <StatList
                  items={[
                    {
                      label: 'Measured',
                      value: job.measured
                        ? 'Yes — from a completed run'
                        : 'No — no completed run yet',
                    },
                    { label: 'Execution', value: job.execution },
                    {
                      label: 'Real patient data',
                      value: job.trainsOnRealPatientData ? 'Yes' : 'No — synthetic only',
                    },
                    { label: 'Checkpoints', value: job.checkpointDir ?? 'not written yet' },
                  ]}
                />
              </>
            ) : null}

            {job.epochs.length > 0 ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Epoch</th>
                      <th>Train loss</th>
                      <th>Val loss</th>
                      <th>Val Dice</th>
                      <th>Val IoU</th>
                      <th>Seconds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.epochs.map((epoch) => (
                      <tr key={epoch.epoch}>
                        <td>{epoch.epoch}</td>
                        <td>{epoch.trainLoss.toFixed(4)}</td>
                        <td>{epoch.validationLoss === null ? '-' : epoch.validationLoss.toFixed(4)}</td>
                        <td>{epoch.validationDice === null ? '-' : epoch.validationDice.toFixed(4)}</td>
                        <td>{epoch.validationIou === null ? '-' : epoch.validationIou.toFixed(4)}</td>
                        <td>{epoch.durationSeconds.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="form-actions">
              <Button
                icon="play"
                variant="primary"
                disabled={busy !== null || IS_DEMO_MODE || running || ready.length === 0 || !job.available}
                onClick={() => void onStartTraining(ready[0].id)}
                title={
                  ready.length === 0
                    ? 'Validate and assign a dataset first.'
                    : !job.available
                      ? 'This deployment has no torch.'
                      : undefined
                }
              >
                Start training on {ready.length > 0 ? ready[0].name : 'a ready dataset'}
              </Button>
              <Button
                icon="stop"
                disabled={busy !== null || IS_DEMO_MODE || !running}
                onClick={() => void onStopTraining()}
              >
                Stop
              </Button>
              <Button
                icon="refresh"
                disabled={busy !== null || IS_DEMO_MODE || running}
                onClick={() => void onResetJob()}
              >
                Clear finished job
              </Button>
            </div>
          </Card>

          <Notice tone="warning" title="What this does and does not claim" icon="warning">
            Training is real: the 3D U-Net learns from the dataset and the loss and Dice
            above are measured from its predictions. The data is synthetic phantoms or
            approved de-identified research data — never identifiable patient data. This
            model is a research prototype and is not clinically validated.
          </Notice>
        </TabPanel>
      ) : null}
    </div>
  );
}
