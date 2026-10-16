// Training page.
//
// The Start / Stop controls call POST /api/v1/training/start and /stop, which run
// a real federated experiment: the Flower server asks each hospital client to
// train locally, and FedAvg aggregates the returned parameters. Clients upload
// parameters only - never examples, labels or volumes.
//
// What it is not: the clients are simulated on this machine, the data is
// synthetic, and the client model is a small stand-in rather than the MRI 3D
// U-Net. The backend states this in `execution` / `measured` and the page repeats
// it, labelling seeded rows as illustrative rather than as results.
//
// The form itself is functional in every mode: validation, presets, save/reset
// (stored in this browser only).

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, ProgressBar, StatList } from '../components/Card';
import { NumberField, RangeField, SelectField, SwitchField } from '../components/FormControls';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { RoundHistoryTable } from '../components/RoundHistoryTable';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { CHART_COLORS, TrainingChart } from '../components/TrainingChart';
import {
  CONFIG_LIMITS,
  DEFAULT_TRAINING_CONFIG,
  DEMO_FEDERATED_CONFIG,
  DEMO_FEDERATED_HISTORY,
  DEMO_HOSPITALS,
  DEMO_METRIC_HISTORY,
  DEMO_TRAINING_STATUS,
} from '../data/demo';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, api, IS_DEMO_MODE } from '../services/api';
import type {
  AggregationMethod,
  FederatedHistory,
  MetricPoint,
  TrainingConfig,
  TrainingConfigResponse,
  TrainingStatus,
} from '../types';

const CONFIG_STORAGE_KEY = 'fedmed.training.config';

type TabId = 'configuration' | 'progress' | 'history';

function validate(config: TrainingConfig): Partial<Record<keyof TrainingConfig, string>> {
  const errors: Partial<Record<keyof TrainingConfig, string>> = {};
  if (config.rounds < CONFIG_LIMITS.rounds.min || config.rounds > CONFIG_LIMITS.rounds.max) {
    errors.rounds = `Enter between ${CONFIG_LIMITS.rounds.min} and ${CONFIG_LIMITS.rounds.max} rounds.`;
  }
  if (
    config.localEpochs < CONFIG_LIMITS.localEpochs.min ||
    config.localEpochs > CONFIG_LIMITS.localEpochs.max
  ) {
    errors.localEpochs = `Enter between ${CONFIG_LIMITS.localEpochs.min} and ${CONFIG_LIMITS.localEpochs.max} epochs.`;
  }
  if (
    !Number.isFinite(config.learningRate) ||
    config.learningRate < CONFIG_LIMITS.learningRate.min ||
    config.learningRate > CONFIG_LIMITS.learningRate.max
  ) {
    errors.learningRate = `Use a rate between ${CONFIG_LIMITS.learningRate.min} and ${CONFIG_LIMITS.learningRate.max}.`;
  }
  if (config.batchSize < CONFIG_LIMITS.batchSize.min || config.batchSize > CONFIG_LIMITS.batchSize.max) {
    errors.batchSize = `Batch size must be between ${CONFIG_LIMITS.batchSize.min} and ${CONFIG_LIMITS.batchSize.max} for this CPU-only setup.`;
  }
  if (config.minClients < CONFIG_LIMITS.minClients.min || config.minClients > CONFIG_LIMITS.minClients.max) {
    errors.minClients = `Between ${CONFIG_LIMITS.minClients.min} and ${CONFIG_LIMITS.minClients.max} clients.`;
  }
  if (
    config.validationSplit < CONFIG_LIMITS.validationSplit.min ||
    config.validationSplit > CONFIG_LIMITS.validationSplit.max
  ) {
    errors.validationSplit = `Keep the validation split between ${CONFIG_LIMITS.validationSplit.min} and ${CONFIG_LIMITS.validationSplit.max}.`;
  }
  if (config.patchSize < CONFIG_LIMITS.patchSize.min || config.patchSize > CONFIG_LIMITS.patchSize.max) {
    errors.patchSize = `Patch size must be between ${CONFIG_LIMITS.patchSize.min} and ${CONFIG_LIMITS.patchSize.max} voxels.`;
  }
  if (config.rounds * config.localEpochs > 200) {
    errors.rounds = 'Rounds x epochs would exceed 200 local training passes on this hardware.';
  }
  return errors;
}

function loadSavedConfig(): TrainingConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_TRAINING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TrainingConfig>;
    return { ...DEFAULT_TRAINING_CONFIG, ...parsed };
  } catch {
    return DEFAULT_TRAINING_CONFIG;
  }
}

export function TrainingPage(): React.JSX.Element {
  // The history endpoint returns the run's rounds plus its provenance, so the
  // seed baseline and a measured run can be told apart rather than merged.
  const historyResource = useApiResource<FederatedHistory>(
    api.trainingHistory,
    DEMO_FEDERATED_HISTORY,
    (value) => value.rounds.length === 0,
  );
  const metricsResource = useApiResource<MetricPoint[]>(
    api.trainingMetrics,
    DEMO_METRIC_HISTORY,
    (value) => value.length === 0,
  );
  const statusResource = useApiResource<TrainingStatus>(api.trainingStatus, DEMO_TRAINING_STATUS);
  const federatedConfigResource = useApiResource<TrainingConfigResponse>(
    api.trainingConfig,
    DEMO_FEDERATED_CONFIG,
  );

  const [tab, setTab] = useState<TabId>('configuration');
  const [config, setConfig] = useState<TrainingConfig>(loadSavedConfig);
  const [touched, setTouched] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const errors = useMemo(() => validate(config), [config]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof TrainingConfig>(key: K, value: TrainingConfig[K]): void => {
    setConfig((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
  };

  const saveConfig = (): void => {
    setTouched(true);
    if (hasErrors) return;
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSavedAt(null);
    }
  };

  const resetConfig = (): void => {
    setConfig(DEFAULT_TRAINING_CONFIG);
    setTouched(false);
    setSavedAt(null);
  };

  const applyPreset = (preset: 'quick' | 'balanced' | 'thorough'): void => {
    const presets: Record<typeof preset, Partial<TrainingConfig>> = {
      // patchSize bounds are 8-32 (the stand-in model's patch, not an MRI volume).
      // The old 32/64/96 presets were outside that range and would be rejected.
      quick: { rounds: 3, localEpochs: 1, batchSize: 1, patchSize: 8 },
      balanced: { rounds: 10, localEpochs: 2, batchSize: 2, patchSize: 16 },
      thorough: { rounds: 25, localEpochs: 3, batchSize: 2, patchSize: 32 },
    };
    setConfig((current) => ({ ...current, ...presets[preset] }));
    setSavedAt(null);
  };

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const rounds = historyResource.data?.rounds ?? [];
  const historyMeasured = historyResource.data?.measured ?? false;
  const metricPoints = metricsResource.data ?? [];
  const job = statusResource.data ?? null;
  const federatedConfig = federatedConfigResource.data ?? DEMO_FEDERATED_CONFIG;

  const lastRound = rounds[rounds.length - 1];
  // Only fall back to the history length when no run has been started. While a
  // run exists, its own count is the truth: falling back to the seeded baseline
  // made a fresh 2-round run display "8 rounds completed".
  const jobStarted = job !== null && job.status !== 'idle';
  const completedRounds = jobStarted ? (job?.completedRounds ?? 0) : rounds.length;
  const plannedRounds = job && job.totalRounds > 0 ? job.totalRounds : config.rounds;
  const progressPercent = (completedRounds / Math.max(plannedRounds, 1)) * 100;
  const jobRunning = job?.status === 'running';

  const { reload: reloadStatus } = statusResource;
  const { reload: reloadHistory } = historyResource;
  const { reload: reloadMetrics } = metricsResource;

  // While the federated run is in progress, re-read its progress so the round count, the
  // charts and the history actually advance. Without this the page keeps showing
  // the snapshot from the moment Start was clicked until the user refreshes.
  useEffect(() => {
    if (!jobRunning) return undefined;
    const timer = window.setInterval(() => {
      reloadStatus();
      reloadHistory();
      reloadMetrics();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobRunning, reloadStatus, reloadHistory, reloadMetrics]);

  /** Start a federated run. Clients train locally; only parameters are uploaded. */
  const startJob = async (): Promise<void> => {
    setActionBusy(true);
    setActionError(null);
    try {
      await api.startTraining(config);
      statusResource.reload();
      historyResource.reload();
      metricsResource.reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The federated run could not be started.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const stopJob = async (): Promise<void> => {
    setActionBusy(true);
    setActionError(null);
    try {
      await api.stopTraining();
      statusResource.reload();
      historyResource.reload();
      metricsResource.reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The federated run could not be stopped.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  if (historyResource.loading || metricsResource.loading || statusResource.loading) {
    return (
      <div className="page">
        <PageHeader title="Training" description="Loading round history." />
        <LoadingState label="Loading training data" />
      </div>
    );
  }

  const resourceError = historyResource.error ?? metricsResource.error ?? statusResource.error;
  if (resourceError) {
    return (
      <div className="page">
        <PageHeader title="Training" description="The training data could not be loaded." />
        <ErrorState
          message={resourceError}
          hint="Start the FastAPI backend, or set VITE_USE_DEMO_DATA=true in frontend/.env."
          onRetry={() => {
            historyResource.reload();
            metricsResource.reload();
            statusResource.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Training"
        description="Configure a federated run, review round history and inspect aggregated metrics."
        action={
          jobRunning ? (
            <StatusBadge tone="info">FEDERATED RUN IN PROGRESS</StatusBadge>
          ) : historyMeasured ? (
            <StatusBadge tone="success">MEASURED RESULTS</StatusBadge>
          ) : (
            <StatusBadge tone="warning">NO RUN YET - BASELINE ONLY</StatusBadge>
          )
        }
      />

      <Notice tone="info" title="Federated learning on synthetic data, all on this machine" icon="info">
        The Flower server, three hospital clients and the FedAvg aggregator are implemented and run
        locally. Each client trains on its own synthetic patches and uploads{' '}
        <strong>model parameters only</strong> - never examples, labels or volumes. The backend reports{' '}
        <code>execution: {federatedConfig.currentExecution}</code> and{' '}
        <code>measured: {String(historyMeasured)}</code>, and this page repeats both rather than
        presenting placeholder values as results.
        {IS_DEMO_MODE
          ? ' Demo mode is on, so the figures come from the frontend sample file and are labelled Illustrative.'
          : ' Figures marked Measured came from a real run; the baseline rows are labelled Illustrative.'}
      </Notice>

      <Notice tone="warning" title="What this is not" icon="warning">
        <ul className="notice__list">
          <li>{federatedConfig.clientModelDescription}</li>
          {federatedConfig.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </Notice>

      {actionError ? (
        <p className="form-status form-status--error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="metrics metrics--4">
        {/* These four read measured values only. With no run they show zero and
            say so, rather than reporting the illustrative baseline (which used to
            display "Rounds completed 8" and a loss when nothing had run). */}
        <MetricCard
          label="Rounds measured"
          value={String(historyMeasured ? completedRounds : 0)}
          unit="rounds"
          icon="activity"
          footnote={
            historyMeasured
              ? `From a real run configured for ${config.rounds} rounds.`
              : 'No federated run has been executed yet. The history below is illustrative.'
          }
        />
        <MetricCard
          label="Last aggregated loss"
          value={
            historyMeasured && lastRound ? lastRound.aggregatedLoss.toFixed(3) : 'n/a'
          }
          icon="training"
          footnote={
            historyMeasured
              ? 'Aggregated loss reported after the final round.'
              : 'Not measured. The illustrative baseline does not count as a result.'
          }
        />
        <MetricCard
          label="Last validation Dice"
          value={
            !historyMeasured ||
            lastRound === undefined ||
            lastRound.aggregatedValidationDice === null
              ? 'n/a'
              : lastRound.aggregatedValidationDice.toFixed(3)
          }
          icon="model"
          footnote={
            historyMeasured
              ? "Mean Dice over each client's held-back validation split."
              : 'Not measured. Requires a real federated run.'
          }
        />
        <MetricCard
          label="Clients reporting"
          value={
            historyMeasured && lastRound
              ? `${lastRound.participants}/${lastRound.expectedParticipants}`
              : `0/${rounds[0]?.expectedParticipants ?? 3}`
          }
          icon="hospital"
          footnote={`${DEMO_HOSPITALS.length} simulated nodes configured.`}
        />
      </div>

      <Tabs
        idPrefix="training"
        active={tab}
        onChange={setTab}
        items={[
          { id: 'configuration', label: 'Configuration' },
          { id: 'progress', label: 'Progress' },
          { id: 'history', label: 'Round history', count: rounds.length },
        ]}
      />

      {tab === 'configuration' ? (
        <TabPanel idPrefix="training" id="configuration">
          <div className="grid grid--sidebar">
            <Card>
              <CardHeader
                title="Training configuration"
                subtitle="Values are validated before they can be saved. Nothing is sent to a server."
                action={
                  <div className="segmented" role="group" aria-label="Presets">
                    <button type="button" className="segmented__item" onClick={() => applyPreset('quick')}>
                      Quick
                    </button>
                    <button type="button" className="segmented__item" onClick={() => applyPreset('balanced')}>
                      Balanced
                    </button>
                    <button type="button" className="segmented__item" onClick={() => applyPreset('thorough')}>
                      Thorough
                    </button>
                  </div>
                }
              />

              <div className="form-grid">
                <NumberField
                  id="cfg-rounds"
                  label="Federated rounds"
                  value={config.rounds}
                  onChange={(value) => update('rounds', value)}
                  min={CONFIG_LIMITS.rounds.min}
                  max={CONFIG_LIMITS.rounds.max}
                  hint={`How many aggregation rounds to run (${CONFIG_LIMITS.rounds.min}-${CONFIG_LIMITS.rounds.max}).`}
                  error={touched ? errors.rounds : undefined}
                />
                <NumberField
                  id="cfg-epochs"
                  label="Local epochs per round"
                  value={config.localEpochs}
                  onChange={(value) => update('localEpochs', value)}
                  min={CONFIG_LIMITS.localEpochs.min}
                  max={CONFIG_LIMITS.localEpochs.max}
                  hint="Epochs each hospital trains before sending an update."
                  error={touched ? errors.localEpochs : undefined}
                />
                <NumberField
                  id="cfg-lr"
                  label="Learning rate"
                  value={config.learningRate}
                  onChange={(value) => update('learningRate', value)}
                  min={CONFIG_LIMITS.learningRate.min}
                  max={CONFIG_LIMITS.learningRate.max}
                  step={0.0001}
                  hint="Small values train more slowly but more stably."
                  error={touched ? errors.learningRate : undefined}
                />
                <NumberField
                  id="cfg-batch"
                  label="Batch size"
                  value={config.batchSize}
                  onChange={(value) => update('batchSize', value)}
                  min={CONFIG_LIMITS.batchSize.min}
                  max={CONFIG_LIMITS.batchSize.max}
                  hint="Kept small: the reference machine trains on CPU only."
                  error={touched ? errors.batchSize : undefined}
                />
                <SelectField<AggregationMethod>
                  id="cfg-aggregation"
                  label="Aggregation method"
                  value={config.aggregation}
                  onChange={(value) => update('aggregation', value)}
                  options={[
                    { value: 'FedAvg', label: 'FedAvg - weighted average of client updates' },
                    { value: 'FedProx', label: 'FedProx - FedAvg with a proximal term' },
                    { value: 'FedAdam', label: 'FedAdam - adaptive server optimiser' },
                  ]}
                  hint="Only the selection is stored; no aggregation runs in Stage 1."
                />
                <NumberField
                  id="cfg-minclients"
                  label="Minimum clients per round"
                  value={config.minClients}
                  onChange={(value) => update('minClients', value)}
                  min={CONFIG_LIMITS.minClients.min}
                  max={CONFIG_LIMITS.minClients.max}
                  unit="nodes"
                  hint="A round is skipped if fewer nodes report."
                  error={touched ? errors.minClients : undefined}
                />
                <RangeField
                  id="cfg-split"
                  label="Validation split"
                  value={config.validationSplit}
                  onChange={(value) => update('validationSplit', value)}
                  min={CONFIG_LIMITS.validationSplit.min}
                  max={CONFIG_LIMITS.validationSplit.max}
                  step={0.05}
                  format={(value) => `${Math.round(value * 100)}%`}
                  hint="Share of each local dataset held back for validation."
                />
                <NumberField
                  id="cfg-patch"
                  label="Patch size"
                  value={config.patchSize}
                  onChange={(value) => update('patchSize', value)}
                  min={CONFIG_LIMITS.patchSize.min}
                  max={CONFIG_LIMITS.patchSize.max}
                  unit="voxels"
                  hint="3D patch edge length. 64 is the default for CPU training."
                  error={touched ? errors.patchSize : undefined}
                />
                <NumberField
                  id="cfg-seed"
                  label="Random seed"
                  value={config.randomSeed}
                  onChange={(value) => update('randomSeed', value)}
                  min={0}
                  max={99999}
                  hint="Keeps data splitting and initialisation reproducible."
                />
              </div>

              <div className="form-actions">
                <Button
                  variant="primary"
                  icon={<Icon name="play" size={16} />}
                  onClick={startJob}
                  loading={actionBusy && !jobRunning}
                  disabled={jobRunning || (touched && hasErrors)}
                  disabledReason={
                    jobRunning
                      ? 'A federated run is already in progress. Stop it first.'
                      : undefined
                  }
                >
                  Start federated run
                </Button>
                <Button
                  icon={<Icon name="stop" size={16} />}
                  onClick={stopJob}
                  loading={actionBusy && jobRunning}
                  disabled={!jobRunning}
                  disabledReason={
                    jobRunning
                      ? undefined
                      : 'No federated run is in progress, so there is nothing to stop.'
                  }
                >
                  Stop
                </Button>
                <Button icon={<Icon name="check" size={16} />} onClick={saveConfig} disabled={touched && hasErrors}>
                  Save configuration
                </Button>
                <Button variant="ghost" onClick={resetConfig}>
                  Reset to defaults
                </Button>
              </div>

              <p className="card__footnote">
                <strong>Start federated run</strong> executes real local training on the three
                simulated clients and aggregates their parameters with FedAvg. Round results appear
                here as they are measured. Nothing is trained on real patient data, and no secure
                aggregation, homomorphic encryption or differential privacy is applied.
              </p>

              {touched && hasErrors ? (
                <p className="form-status form-status--error" role="alert">
                  Fix the highlighted fields before saving.
                </p>
              ) : null}
              {savedAt ? (
                <p className="form-status form-status--ok" role="status">
                  Configuration saved in this browser at {savedAt}. It is not stored on any server.
                </p>
              ) : null}
            </Card>

            <div className="stack">
              <Card>
                <CardHeader title="Privacy options" subtitle="Selection only - no mechanism is implemented yet" />
                <SwitchField
                  id="cfg-dp"
                  label="Differential privacy"
                  checked={false}
                  onChange={() => undefined}
                  hint="Would add calibrated noise to client updates. Shown off because nothing is implemented: the switch cannot be used."
                  disabled
                  disabledReason="Not implemented (planned for milestone M5)."
                />
                <SwitchField
                  id="cfg-secagg"
                  label="Secure aggregation"
                  checked={false}
                  onChange={() => undefined}
                  hint="Would mask updates so only their sum is visible. Shown off because nothing is implemented."
                  disabled
                  disabledReason="Not implemented (planned for milestone M5)."
                />
                <SwitchField
                  id="cfg-he"
                  label="Homomorphic encryption"
                  checked={false}
                  onChange={() => undefined}
                  hint="Would aggregate over encrypted updates with TenSEAL. Shown off because nothing is implemented."
                  disabled
                  disabledReason="Not implemented (planned for milestone M5)."
                />
                <p className="card__footnote">
                  These toggles are permanently off and disabled: no privacy mechanism exists in the project,
                  so none is shown as active. The privacy options in a saved configuration are reserved for
                  milestone M5.
                </p>
              </Card>

              <Card>
                <CardHeader title="Current selection" subtitle="Read back from the form above" />
                <StatList
                  columns={2}
                  items={[
                    { label: 'Rounds', value: String(config.rounds) },
                    { label: 'Local epochs', value: String(config.localEpochs) },
                    { label: 'Aggregation', value: config.aggregation },
                    { label: 'Minimum clients', value: `${config.minClients} nodes` },
                    { label: 'Batch size', value: String(config.batchSize) },
                    { label: 'Patch size', value: `${config.patchSize}\u00B3 voxels` },
                  ]}
                />
              </Card>
            </div>
          </div>
        </TabPanel>
      ) : null}

      {tab === 'progress' ? (
        <TabPanel idPrefix="training" id="progress">
          <Card>
            <CardHeader
              title="Training progress"
              subtitle="Global loss versus validation loss over the completed demo rounds"
            />
            <ProgressBar
              label={`${completedRounds} of ${plannedRounds} rounds complete${IS_DEMO_MODE ? ' (demo)' : ''}`}
              value={progressPercent}
              tone={completedRounds === 0 ? 'warning' : 'success'}
            />
            <TrainingChart
              bare
              title="Loss by round"
              height={300}
              data={metricPoints}
              ariaLabel="Line chart of global loss and validation loss per round"
              series={[
                { key: 'loss', label: 'Global loss', color: CHART_COLORS.loss },
                {
                  key: 'validationLoss',
                  label: 'Validation loss',
                  color: CHART_COLORS.validationLoss,
                  dashed: true,
                },
              ]}
              yDomain={[0, 'auto']}
            />
          </Card>

          <div className="grid grid--2">
            <TrainingChart
              title="Dice score by round"
              subtitle="Higher is better"
              data={metricPoints}
              ariaLabel="Line chart of Dice score per round"
              series={[{ key: 'dice', label: 'Dice', color: CHART_COLORS.dice }]}
              yDomain={[0, 1]}
            />
            <TrainingChart
              title="Accuracy by round"
              subtitle="Voxel-wise agreement with the reference mask"
              data={metricPoints}
              ariaLabel="Line chart of accuracy per round"
              series={[{ key: 'accuracy', label: 'Accuracy', color: CHART_COLORS.accuracy }]}
              yDomain={[0.5, 1]}
            />
          </div>
        </TabPanel>
      ) : null}

      {tab === 'history' ? (
        <TabPanel idPrefix="training" id="history">
          <RoundHistoryTable
            rounds={rounds}
            subtitle={
              historyMeasured
                ? 'Aggregated metrics per round, measured by a real federated run.'
                : 'Illustrative round values. No federated run has been executed, so these are not measurements.'
            }
          />
        </TabPanel>
      ) : null}
    </div>
  );
}
