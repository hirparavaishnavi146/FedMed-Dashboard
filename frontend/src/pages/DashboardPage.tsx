// Dashboard: the state of the federation at a glance.
//
// Demo mode gets the derived demo payload; live mode gets the same shape from
// GET /api/v1/dashboard/metrics. The page itself does not branch on the mode.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader, ProgressBar, StatList } from '../components/Card';
import { ComparisonBarChart, CHART_COLORS, TrainingChart } from '../components/TrainingChart';
import { HospitalTable, formatDateTime } from '../components/HospitalTable';
import { MetricCard } from '../components/MetricCard';
import { ErrorState, LoadingState, Notice, SkeletonRows } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { DEMO_DASHBOARD_METRICS, DEMO_EXPLANATION, DEMO_HOSPITALS } from '../data/demo';
import { useApiResource } from '../hooks/useApiResource';
import { api, IS_DEMO_MODE } from '../services/api';
import type { ActivityEvent, DashboardMetrics, Hospital } from '../types';

const ACTIVITY_ICONS: Record<
  ActivityEvent['kind'],
  'activity' | 'server' | 'model' | 'privacy' | 'info'
> = {
  round: 'activity',
  client: 'server',
  model: 'model',
  privacy: 'privacy',
  system: 'info',
};

export function DashboardPage(): React.JSX.Element {
  const metrics = useApiResource<DashboardMetrics>(api.dashboardMetrics, DEMO_DASHBOARD_METRICS);
  const hospitals = useApiResource<Hospital[]>(
    api.hospitals,
    DEMO_HOSPITALS,
    (value) => value.length === 0,
  );

  const [history, setHistory] = useState<'all' | '6' | '3'>('all');

  const data = metrics.data;
  const nodes = hospitals.data ?? [];

  const chartData = useMemo(() => {
    const series = data?.metricHistory ?? [];
    if (history === 'all') return series;
    return series.slice(-Number(history));
  }, [data, history]);

  if (metrics.loading || hospitals.loading) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" description="Loading the latest federation state." />
        <div className="metrics metrics--4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <SkeletonRows rows={3} />
            </Card>
          ))}
        </div>
        <LoadingState label="Loading dashboard data" />
      </div>
    );
  }

  if (metrics.error ?? hospitals.error) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" description="The federation overview could not be loaded." />
        <ErrorState
          message={(metrics.error ?? hospitals.error) as string}
          hint="Start the FastAPI backend, or set VITE_USE_DEMO_DATA=true in frontend/.env to use demo data."
          onRetry={() => {
            metrics.reload();
            hospitals.reload();
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" description="No dashboard data is available." />
        <ErrorState message="The dashboard endpoint returned no payload." onRetry={metrics.reload} />
      </div>
    );
  }

  const rounds = data.recentRounds;
  // Real upload counts. Defensive default so an older API response without the field
  // renders zeroes rather than crashing the page.
  const activity = data.reportActivity ?? DEMO_DASHBOARD_METRICS.reportActivity;
  const lastRound = rounds[rounds.length - 1];
  const previousRound = rounds[rounds.length - 2];
  const activeModel = data.currentModel;
  const trainingRunning = data.trainingStatus === 'running';
  const diceImproved =
    lastRound && previousRound
      ? (lastRound.aggregatedValidationDice ?? 0) >= (previousRound.aggregatedValidationDice ?? 0)
      : true;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Federation health, training progress and hospital participation at a glance."
        action={
          data.trainingTrainsModel ? (
            <StatusBadge tone="success">TRAINING ACTIVE</StatusBadge>
          ) : (
            <StatusBadge tone="warning" withDot>
              {IS_DEMO_MODE ? 'DEMO DATA' : 'NO MODEL TRAINED'}
            </StatusBadge>
          )
        }
      />

      {/* This notice is CONDITIONAL. It used to be unconditional, so the page kept
          claiming "no model is trained" even after a real run had measured rounds --
          the one message a visitor would use to judge whether anything here is real. */}
      {data.trainingMeasured ? (
        <Notice tone="info" title="These figures come from a real training run">
          {`${data.federatedRounds} round(s) were aggregated by the federated strategy and the metrics shown are the ones it measured, not sample values. `}
          {data.currentModel
            ? `The active model is ${data.currentModel.version}. `
            : ''}
          The training data is procedurally generated synthetic phantoms — no real patient
          scan is used — so these numbers describe the pipeline, not clinical performance.
        </Notice>
      ) : (
        <Notice tone="demo" title="No model is trained - the federation figures here are illustrative">
          {DEMO_EXPLANATION}
          {IS_DEMO_MODE
            ? ' This page is in demo mode, so the values come from the frontend sample file.'
            : ' These values come from the FedMed API. No run has been measured yet, so the federation figures are illustrative and cannot come from a medical report.'}
        </Notice>
      )}

      {/* Real counts, kept visually distinct from the illustrative federation figures
          above so the two are never read as the same kind of number. */}
      <Card>
        <CardHeader
          title="Your uploaded reports"
          subtitle="Counted from reports actually uploaded to this server. Not generated."
          action={
            activity.measured ? (
              <StatusBadge tone="success">MEASURED</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">NO SERVER</StatusBadge>
            )
          }
        />
        <div className="metrics metrics--4">
          <MetricCard
            label="Reports uploaded"
            value={String(activity.reportsUploaded)}
            unit={`in ${activity.sessions} session${activity.sessions === 1 ? '' : 's'}`}
            icon="database"
            footnote={
              activity.reportsUploaded === 0
                ? 'Nothing uploaded yet.'
                : `${activity.reportsReadable} readable, ${activity.reportsUnreadable} not.`
            }
          />
          <MetricCard
            label="Values extracted"
            value={String(activity.valuesExtracted)}
            unit="laboratory values"
            icon="activity"
            footnote="Read from the reports themselves, verbatim."
          />
          <MetricCard
            label="Outside printed range"
            value={String(activity.valuesOutsidePrintedRange)}
            unit="values"
            icon="warning"
            footnote="Only where the report printed a range it falls outside."
          />
          <MetricCard
            label="No range printed"
            value={String(activity.valuesWithoutPrintedRange)}
            unit="values"
            icon="info"
            footnote="Left unjudged: no verdict is possible without a reference range."
          />
        </div>
        <StatList
          items={[
            { label: 'Analyses run', value: String(activity.analysesRun) },
            {
              label: 'Same patient confirmed',
              value: `${activity.samePatientConfirmed} of ${activity.sessions}`,
            },
            { label: 'Read by OCR', value: String(activity.reportsReadByOcr) },
            { label: 'Documented diagnoses', value: String(activity.documentedDiagnoses) },
            { label: 'Documented medications', value: String(activity.documentedMedications) },
            { label: 'Reports containing red flags', value: String(activity.reportsWithRedFlags) },
            { label: 'Latest urgency', value: activity.latestUrgency ?? 'none assessed yet' },
          ]}
        />
        <p className="card__footnote">{activity.note}</p>
        <div className="form-actions">
          <Link className="btn" to="/medical-reports">
            Upload reports to add real data
          </Link>
        </div>
      </Card>

      <div className="metrics metrics--4">
        <MetricCard
          label="Participating hospitals"
          value={String(data.participatingHospitals)}
          unit={`of ${data.totalHospitals} nodes`}
          icon="hospital"
          footnote={`${data.totalStudies.toLocaleString()} synthetic studies across all nodes.`}
        />
        <MetricCard
          label="Federated rounds"
          value={String(data.federatedRounds)}
          unit="completed"
          icon="activity"
          footnote={`Last aggregation ${
            data.lastRoundAt ? formatDateTime(data.lastRoundAt) : 'not run'
          }.`}
        />
        <MetricCard
          label="Global Dice score"
          value={
            lastRound?.aggregatedValidationDice === null || lastRound === undefined
              ? 'n/a'
              : lastRound.aggregatedValidationDice.toFixed(3)
          }
          icon="model"
          delta={
            lastRound && previousRound
              ? {
                  value: `${diceImproved ? '+' : ''}${(
                    (lastRound.aggregatedValidationDice ?? 0) -
                    (previousRound.aggregatedValidationDice ?? 0)
                  ).toFixed(3)}`,
                  direction: diceImproved ? 'up' : 'down',
                  good: diceImproved,
                }
              : undefined
          }
          footnote="Generated value, not a measurement of a trained model."
        />
        <MetricCard
          label="Training status"
          value={trainingRunning ? 'Running' : 'Idle'}
          unit={trainingRunning ? 'run in progress' : 'no run in progress'}
          icon="server"
          footnote={
            data.trainingTrainsModel
              ? 'A model is being trained.'
              : 'The job is simulated: it advances rounds on a timer and trains nothing.'
          }
        />
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHeader
            title="Training progress"
            subtitle="Global loss and validation loss across federated rounds"
            action={
              <div className="segmented" role="group" aria-label="Number of rounds shown">
                {(['all', '6', '3'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`segmented__item${
                      history === option ? ' segmented__item--active' : ''
                    }`}
                    aria-pressed={history === option}
                    onClick={() => setHistory(option)}
                  >
                    {option === 'all' ? 'All rounds' : `Last ${option}`}
                  </button>
                ))}
              </div>
            }
          />
          <TrainingChart
            bare
            title="Training progress"
            height={260}
            data={chartData}
            ariaLabel="Line chart of global loss and validation loss per federated round"
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
          <ProgressBar label={`${data.federatedRounds} rounds recorded`} value={100} tone="success" />
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Aggregation, model and privacy events"
            action={
              <Button size="sm" icon={<Icon name="refresh" size={16} />} onClick={metrics.reload}>
                Reload
              </Button>
            }
          />
          {data.activity.length === 0 ? (
            <p className="card__footnote">No activity has been recorded yet.</p>
          ) : (
            <ul className="activity">
              {data.activity.map((event) => (
                <li className="activity__item" key={event.id}>
                  <span
                    className={`activity__icon activity__icon--${event.kind}`}
                    aria-hidden="true"
                  >
                    <Icon name={ACTIVITY_ICONS[event.kind]} size={16} />
                  </span>
                  <div className="activity__body">
                    <p className="activity__title">{event.title}</p>
                    <p className="activity__detail">{event.detail}</p>
                    <p className="activity__time">{formatDateTime(event.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHeader title="Aggregation quality" subtitle="Global Dice and accuracy per round" />
          <TrainingChart
            bare
            title="Aggregation quality"
            height={260}
            data={data.metricHistory}
            ariaLabel="Line chart of global Dice score and accuracy per federated round"
            series={[
              { key: 'dice', label: 'Dice score', color: CHART_COLORS.dice },
              { key: 'accuracy', label: 'Accuracy', color: CHART_COLORS.accuracy },
            ]}
            yDomain={[0.4, 1]}
          />
        </Card>

        <div className="stack">
          <ComparisonBarChart
            title="Dataset size per hospital"
            subtitle="Synthetic studies available locally at each node (GB)"
            ariaLabel="Bar chart of synthetic dataset size in gigabytes per hospital"
            unit=" GB"
            points={nodes.map((hospital) => ({
              label: hospital.id,
              value: hospital.sizeGb,
              color: hospital.status === 'online' ? '#0b3b5c' : '#f59e0b',
            }))}
          />
          <Card>
            <CardHeader title="Model in use" subtitle={activeModel?.version} />
            {activeModel ? (
              <StatList
                columns={2}
                items={[
                  { label: 'Version', value: activeModel.version },
                  {
                    label: 'Status',
                    value: <StatusBadge tone="success">{activeModel.status}</StatusBadge>,
                  },
                  { label: 'Dice', value: activeModel.dice.toFixed(3) },
                  { label: 'IoU', value: activeModel.iou.toFixed(3) },
                  { label: 'Accuracy', value: activeModel.accuracy.toFixed(3) },
                  { label: 'Rounds trained', value: String(activeModel.rounds) },
                ]}
              />
            ) : (
              <p className="card__footnote">No model version is registered.</p>
            )}
          </Card>
        </div>
      </div>

      <HospitalTable
        hospitals={nodes}
        compact
        title="Hospital participation overview"
        subtitle={`${nodes.length} simulated nodes. Open the Hospitals page for the full table and details.`}
      />
    </div>
  );
}
