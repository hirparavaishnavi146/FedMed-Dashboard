// Model Results page: validation metrics and version comparison.
//
// Every number is a generated value - no model has been trained. In live mode
// the data comes from GET /api/v1/model/results, /training/metrics and
// /training/history; in demo mode from the frontend sample module.

import { useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, ProgressBar, StatList } from '../components/Card';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { RoundHistoryTable } from '../components/RoundHistoryTable';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import {
  CHART_COLORS,
  ComparisonBarChart,
  TrainingChart,
  TrendAreaChart,
} from '../components/TrainingChart';
import { DEMO_FEDERATED_HISTORY, DEMO_METRIC_HISTORY, DEMO_MODEL_RESULTS } from '../data/demo';
import { useApiResource } from '../hooks/useApiResource';
import { api } from '../services/api';
import type { FederatedHistory, MetricPoint, ModelResults } from '../types';

type TabId = 'metrics' | 'comparison' | 'history';

export function ModelResultsPage(): React.JSX.Element {
  const results = useApiResource<ModelResults>(api.modelResults, DEMO_MODEL_RESULTS);
  const metrics = useApiResource<MetricPoint[]>(
    api.trainingMetrics,
    DEMO_METRIC_HISTORY,
    (value) => value.length === 0,
  );
  const history = useApiResource<FederatedHistory>(
    api.trainingHistory,
    DEMO_FEDERATED_HISTORY,
    (value) => value.rounds.length === 0,
  );

  const models = results.data?.models ?? [];
  const metricsData = metrics.data ?? [];
  const rounds = history.data?.rounds ?? [];
  // Measured results from a real run. `available: false` means no run has been
  // performed — the page then labels everything as illustrative rather than
  // rendering zeroes that would read as measured failures.
  const measured = results.data?.measuredExperiment;

  const [tab, setTab] = useState<TabId>('metrics');
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  // Default to the newest version once the data arrives.
  const activeSelection =
    models.find((model) => model.version === selectedVersion) ??
    results.data?.latestVersion ??
    models[models.length - 1];

  const best = results.data?.bestVersion ?? null;

  if (results.loading || metrics.loading || history.loading) {
    return (
      <div className="page">
        <PageHeader title="Model Results" description="Loading model versions." />
        <LoadingState label="Loading model results" />
      </div>
    );
  }

  const loadError = results.error ?? metrics.error ?? history.error;
  if (loadError) {
    return (
      <div className="page">
        <PageHeader title="Model Results" description="Model results could not be loaded." />
        <ErrorState
          message={loadError}
          hint="Start the FastAPI backend, or set VITE_USE_DEMO_DATA=true in frontend/.env to browse demo values."
          onRetry={() => {
            results.reload();
            metrics.reload();
            history.reload();
          }}
        />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Model Results" description="No model versions are registered." />
        <ErrorState
          message="The model results endpoint returned no versions."
          onRetry={results.reload}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Model Results"
        description="Measured results from a real training run, and the illustrative version registry."
        action={
          measured?.available ? (
            <StatusBadge tone="success">MEASURED EXPERIMENT</StatusBadge>
          ) : (
            <StatusBadge tone="warning">ILLUSTRATIVE ONLY</StatusBadge>
          )
        }
      />

      {measured?.available ? (
        <Notice tone="info" title="Measured results: a real 3D U-Net run on synthetic data">
          {measured.model
            ? `${measured.model.architecture} with ${measured.model.parameterCount.toLocaleString()} parameters`
            : 'The 3D U-Net'}{' '}
          trained for {measured.epochCount} epoch(s)
          {measured.site ? ` on site ${measured.site}` : ''}
          {measured.lossImproved ? ', and the training loss fell' : ''}. Dice, IoU and loss below come
          from actual predictions on validation volumes.{' '}
          {measured.provenance?.containsPatientData === false
            ? 'The data is synthetic, so this is not a clinical result.'
            : ''}{' '}
          {measured.provenance?.note ?? ''}
        </Notice>
      ) : (
        <Notice tone="warning" title="No measured experiment available">
          {measured?.unavailableReason ??
            'No training run has been recorded, so there are no measured results to show.'}{' '}
          <strong>Every value on this page is illustrative</strong> — the version registry below is
          sample data produced for interface development, and none of it measures a model.
        </Notice>
      )}

      {measured?.available ? (
        <div className="metrics metrics--4">
          <MetricCard
            label="Best validation Dice"
            value={measured.bestDice === null ? 'n/a' : measured.bestDice.toFixed(3)}
            icon="activity"
            footnote="Measured on synthetic validation volumes."
          />
          <MetricCard
            label="Training loss"
            value={
              measured.firstTrainLoss === null || measured.lastTrainLoss === null
                ? 'n/a'
                : `${measured.firstTrainLoss.toFixed(3)} -> ${measured.lastTrainLoss.toFixed(3)}`
            }
            icon="training"
            footnote={measured.lossImproved ? 'Loss fell over the run.' : 'Loss did not fall.'}
          />
          <MetricCard
            label="Checkpoint re-evaluated"
            value={
              measured.holdout?.dice === null || measured.holdout?.dice === undefined
                ? 'n/a'
                : measured.holdout.dice.toFixed(3)
            }
            icon="model"
            footnote={
              measured.holdout
                ? `Reloaded from disk, ${measured.holdout.cases} validation case(s).`
                : undefined
            }
          />
          <MetricCard
            label="Epochs measured"
            value={String(measured.epochCount)}
            icon="server"
            footnote={measured.bestEpoch === null ? undefined : `Best at epoch ${measured.bestEpoch}.`}
          />
        </div>
      ) : null}

      {measured?.available && measured.epochs.length > 0 ? (
        <Card>
          <CardHeader
            title="Measured epoch history"
            subtitle="Values computed from the model's predictions, not generated."
          />
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Measured per-epoch training and validation metrics
              </caption>
              <thead>
                <tr>
                  <th scope="col">Epoch</th>
                  <th scope="col">Train loss</th>
                  <th scope="col">Val loss</th>
                  <th scope="col">Val Dice</th>
                  <th scope="col">Val IoU</th>
                  <th scope="col">Cases</th>
                  <th scope="col">Seconds</th>
                </tr>
              </thead>
              <tbody>
                {measured.epochs.map((record) => (
                  <tr key={record.epoch}>
                    <th scope="row" data-label="Epoch">
                      {record.epoch}
                    </th>
                    <td data-label="Train loss">{record.trainLoss.toFixed(4)}</td>
                    <td data-label="Val loss">
                      {record.validationLoss === null ? '—' : record.validationLoss.toFixed(4)}
                    </td>
                    <td data-label="Val Dice">
                      {record.validationDice === null ? '—' : record.validationDice.toFixed(4)}
                    </td>
                    <td data-label="Val IoU">
                      {record.validationIou === null ? '—' : record.validationIou.toFixed(4)}
                    </td>
                    <td data-label="Cases">{record.validationSamples}</td>
                    <td data-label="Seconds">{record.durationSeconds.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Notice tone="demo" title="The version registry below is illustrative">
        {results.data?.registryNotice ??
          'Every value in the version registry is illustrative sample data.'}{' '}
        These Dice, IoU, accuracy and loss values are realistic-looking placeholders produced for
        interface development. They are not measurements of any model, and they are kept in a
        separate field from the measured experiment above so the two cannot be read as one list.
      </Notice>

      <div className="metrics metrics--4">
        <MetricCard
          label="Latest model version"
          value={results.data?.latestVersion?.version ?? 'n/a'}
          icon="model"
          footnote={
            results.data?.latestVersion
              ? `Created ${new Date(results.data.latestVersion.createdAt).toLocaleDateString()}`
              : undefined
          }
        />
        <MetricCard
          label="Dice score"
          value={activeSelection ? activeSelection.dice.toFixed(3) : 'n/a'}
          icon="activity"
          footnote="Generated overlap value, not a measurement."
        />
        <MetricCard
          label="Intersection over union"
          value={activeSelection ? activeSelection.iou.toFixed(3) : 'n/a'}
          icon="dashboard"
          footnote="Generated value, not a measurement."
        />
        <MetricCard
          label="Best version so far"
          value={best?.version ?? 'n/a'}
          unit={best ? `Dice ${best.dice.toFixed(3)}` : undefined}
          icon="check"
          footnote="Highest Dice among the registered versions."
        />
      </div>

      <Tabs
        idPrefix="results"
        active={tab}
        onChange={setTab}
        items={[
          { id: 'metrics', label: 'Metrics' },
          { id: 'comparison', label: 'Model comparison' },
          { id: 'history', label: 'Training history', count: rounds.length },
        ]}
      />

      {tab === 'metrics' ? (
        <TabPanel idPrefix="results" id="metrics">
          <Card>
            <CardHeader
              title="Model version"
              subtitle="Select a version to inspect its reported metrics"
              action={
                <div className="segmented segmented--wrap" role="group" aria-label="Model version">
                  {models.map((model) => (
                    <button
                      key={model.version}
                      type="button"
                      className={`segmented__item${
                        model.version === activeSelection?.version ? ' segmented__item--active' : ''
                      }`}
                      aria-pressed={model.version === activeSelection?.version}
                      onClick={() => setSelectedVersion(model.version)}
                    >
                      {model.version}
                    </button>
                  ))}
                </div>
              }
            />

            {activeSelection ? (
              <>
                <div className="detail__badges">
                  <StatusBadge
                    tone={
                      activeSelection.status === 'active'
                        ? 'success'
                        : activeSelection.status === 'candidate'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {activeSelection.status === 'active'
                      ? 'Active'
                      : activeSelection.status === 'candidate'
                        ? 'Candidate'
                        : 'Archived'}
                  </StatusBadge>
                  <span className="table__meta">{activeSelection.notes}</span>
                </div>

                <StatList
                  columns={3}
                  items={[
                    { label: 'Version', value: activeSelection.version },
                    { label: 'Dice', value: activeSelection.dice.toFixed(3) },
                    { label: 'IoU', value: activeSelection.iou.toFixed(3) },
                    { label: 'Accuracy', value: activeSelection.accuracy.toFixed(3) },
                    { label: 'Loss', value: activeSelection.loss.toFixed(3) },
                    { label: 'Rounds trained', value: String(activeSelection.rounds) },
                    { label: 'Sensitivity', value: activeSelection.sensitivity.toFixed(3) },
                    { label: 'Specificity', value: activeSelection.specificity.toFixed(3) },
                    { label: 'Created', value: new Date(activeSelection.createdAt).toLocaleString() },
                  ]}
                />

                <div className="detail__row">
                  <Button
                    icon={<Icon name="model" size={16} />}
                    disabled
                    disabledReason="There is no model file to export: no training has run yet."
                  >
                    Export model weights
                  </Button>
                  <Button
                    disabled
                    disabledReason="Promoting a version requires a trained model and a reviewed evaluation run."
                  >
                    Promote to active
                  </Button>
                </div>
              </>
            ) : null}
          </Card>

          <div className="grid grid--2">
            <TrainingChart
              title="Dice score by round"
              subtitle="Progress across federated rounds"
              data={metricsData}
              ariaLabel="Line chart of Dice score per federated round"
              series={[{ key: 'dice', label: 'Dice', color: CHART_COLORS.dice }]}
              yDomain={[0, 1]}
            />
            <TrainingChart
              title="Loss by round"
              subtitle="Global loss and validation loss"
              data={metricsData}
              ariaLabel="Line chart of loss per federated round"
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
          </div>

          <TrendAreaChart
            title="Accuracy trend"
            subtitle="Voxel-wise agreement with the reference mask"
            data={metricsData}
            ariaLabel="Area chart of accuracy per federated round"
            series={[{ key: 'accuracy', label: 'Accuracy', color: CHART_COLORS.accuracy }]}
            yDomain={[0.5, 1]}
          />
        </TabPanel>
      ) : null}

      {tab === 'comparison' ? (
        <TabPanel idPrefix="results" id="comparison">
          <ComparisonBarChart
            title="Dice score by model version"
            subtitle="Higher is better. Generated values only."
            ariaLabel="Bar chart comparing Dice score across model versions"
            points={models.map((model) => ({
              label: model.version,
              value: model.dice,
              color:
                model.status === 'active'
                  ? '#0b3b5c'
                  : model.status === 'candidate'
                    ? '#0d7d72'
                    : '#94a3b8',
            }))}
            unit=""
          />

          <Card>
            <CardHeader
              title="Version comparison"
              subtitle="All metrics side by side. Values are generated placeholders."
            />
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Comparison of model versions</caption>
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Status</th>
                    <th scope="col">Dice</th>
                    <th scope="col">IoU</th>
                    <th scope="col">Accuracy</th>
                    <th scope="col">Loss</th>
                    <th scope="col">Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.version}>
                      <th scope="row" data-label="Version">
                        {model.version}
                      </th>
                      <td data-label="Status">
                        <StatusBadge
                          tone={
                            model.status === 'active'
                              ? 'success'
                              : model.status === 'candidate'
                                ? 'info'
                                : 'neutral'
                          }
                        >
                          {model.status}
                        </StatusBadge>
                      </td>
                      <td data-label="Dice">
                        {model.dice.toFixed(3)}
                        {best && model.version === best.version ? (
                          <span className="table__meta"> best</span>
                        ) : null}
                      </td>
                      <td data-label="IoU">{model.iou.toFixed(3)}</td>
                      <td data-label="Accuracy">{model.accuracy.toFixed(3)}</td>
                      <td data-label="Loss">{model.loss.toFixed(3)}</td>
                      <td data-label="Rounds">{model.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Metric coverage versus target"
              subtitle="Progress towards the reference targets chosen for the project (not achieved)"
            />
            <ProgressBar label="Dice target 0.85" value={((best?.dice ?? 0) * 100) / 0.85} tone="primary" />
            <ProgressBar label="IoU target 0.75" value={((best?.iou ?? 0) / 0.75) * 100} tone="primary" />
            <ProgressBar
              label="Accuracy target 0.95"
              value={((best?.accuracy ?? 0) / 0.95) * 100}
              tone="primary"
            />
            <p className="card__footnote">
              Percentages above compare the reported values with the targets set for the project. They
              are not measurements of a trained model.
            </p>
          </Card>
        </TabPanel>
      ) : null}

      {tab === 'history' ? (
        <TabPanel idPrefix="results" id="history">
          <RoundHistoryTable
            rounds={rounds}
            title="Training history"
            subtitle="Per-round aggregated metrics. Generated values."
          />
        </TabPanel>
      ) : null}
    </div>
  );
}
