// The starting point: which workflow to use, and why there are two.
//
// WHY THIS PAGE EXISTS
// The application has two pipelines that take completely different input and produce
// completely different output, and the difference is not cosmetic -- it is a hard
// technical boundary that a visitor cannot be expected to guess:
//
//   * MRI / CT IMAGE VOLUMES train the 3D U-Net. The model learns from voxel data: a 3D
//     array of image intensities plus a matching mask saying which voxels are the target.
//   * MEDICAL REPORTS are text. They are read, parsed, compared and summarised. Nothing
//     is trained on them, and nothing could be: a PDF contains no voxels.
//
// Saying "upload a report and the model will train" would be false, so this page states
// what each path actually needs and what each actually produces, then routes to it.
//
// The status figures are read from the live API (or the demo payload), never invented.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader, StatList } from '../components/Card';
import { Icon } from '../components/Icon';
import { Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { api, ApiError, IS_DEMO_MODE } from '../services/api';
import type { DatasetSummary, ReportActivity } from '../types';

interface PathStatus {
  datasetCount: number;
  readyToTrain: number;
  casesReady: number;
  reportsUploaded: number;
  reportsExtracted: number;
  analysesRun: number;
}

const EMPTY_STATUS: PathStatus = {
  datasetCount: 0,
  readyToTrain: 0,
  casesReady: 0,
  reportsUploaded: 0,
  reportsExtracted: 0,
  analysesRun: 0,
};

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

export function StartPage(): React.JSX.Element {
  const [status, setStatus] = useState<PathStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (IS_DEMO_MODE) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        // Two independent calls: a failure in one must not hide the other path's state.
        const [datasets, metrics] = await Promise.allSettled([
          api.datasets(),
          api.dashboardMetrics(),
        ]);

        if (cancelled) return;

        const next = { ...EMPTY_STATUS };
        if (datasets.status === 'fulfilled') {
          const list: DatasetSummary[] = datasets.value.datasets ?? [];
          next.datasetCount = list.length;
          next.readyToTrain = list.filter((item) => item.readyToTrain).length;
          next.casesReady = list.reduce(
            (total, item) => total + (item.validCaseCount ?? 0),
            0,
          );
        }
        if (metrics.status === 'fulfilled') {
          const activity: ReportActivity | undefined = metrics.value.reportActivity;
          next.reportsUploaded = activity?.reportsUploaded ?? 0;
          next.reportsExtracted = activity?.reportsReadable ?? 0;
          next.analysesRun = activity?.analysesRun ?? 0;
        }

        const failures = [datasets, metrics].filter((r) => r.status === 'rejected');
        setProblem(
          failures.length
            ? `Could not read all status figures: ${readableError(
                (failures[0] as PromiseRejectedResult).reason,
              )}`
            : null,
        );
        setStatus(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const trainReadyLabel = loading
    ? 'checking...'
    : `${status.readyToTrain} of ${status.datasetCount}`;

  return (
    <div className="page">
      <PageHeader
        title="Get results"
        description="Two workflows, two different kinds of input. Pick the one that matches what you actually have."
        action={<StatusBadge tone="info">START HERE</StatusBadge>}
      />

      <Notice tone="info" title="Why there are two, and not one" icon="info">
        The MRI model learns from <strong>image volumes</strong> — a 3D grid of voxel
        intensities plus a mask marking the target region. A medical report is{' '}
        <strong>text</strong>; it contains no voxels, so no model can be trained on it.
        Reports are read and analysed instead. Both paths below produce real output from
        your files; they just answer different questions.
      </Notice>

      {problem ? (
        <Notice tone="warning" title="Some figures could not be loaded" icon="warning">
          {problem}
        </Notice>
      ) : null}

      <div className="grid grid--2">
        {/* ------------------------- volumes -> training ------------------------- */}
        <Card>
          <CardHeader
            title="I have MRI / CT image volumes"
            subtitle="Trains a real model. This is the only input that can."
            action={<StatusBadge tone="success">TRAINS A MODEL</StatusBadge>}
          />
          <p className="card__lead">
            Upload 3D scans with their matching masks, assign them to a hospital, and
            train the 3D U-Net. You get a real model and the metrics it measured.
          </p>
          <StatList
            items={[
              {
                label: 'What to bring',
                value: '.nii or .nii.gz volumes, each with a matching _seg mask',
              },
              { label: 'Datasets registered', value: String(status.datasetCount) },
              { label: 'Ready to train', value: trainReadyLabel },
              { label: 'Valid cases', value: String(status.casesReady) },
              {
                label: 'What you get',
                value: 'A trained model, per-round loss, Dice / IoU on held-out cases',
              },
              {
                label: 'Requires',
                value: 'Image + mask on the same voxel grid and spacing',
              },
            ]}
          />
          <div className="form-actions">
            <Link className="btn btn--primary" to="/datasets">
              <Icon name="database" size={16} /> Prepare data and train
            </Link>
          </div>
          <p className="card__footnote">
            Training runs on the machine hosting the API. It is unavailable on a
            deployment without PyTorch installed, which answers 503 rather than
            pretending to train.
          </p>
        </Card>

        {/* ------------------------- reports -> analysis ------------------------- */}
        <Card>
          <CardHeader
            title="I have medical reports"
            subtitle="Read, compared and analysed. No training involved."
            action={<StatusBadge tone="info">ANALYSIS, NOT TRAINING</StatusBadge>}
          />
          <p className="card__lead">
            Upload one to three reports for a patient. The facts are extracted from them,
            compared across reports, and written up as a structured draft for a
            consultation.
          </p>
          <StatList
            items={[
              {
                label: 'What to bring',
                value: 'PDF, scanned image, or text reports — up to 3 per patient',
              },
              { label: 'Reports uploaded', value: String(status.reportsUploaded) },
              { label: 'Read successfully', value: String(status.reportsExtracted) },
              { label: 'Analyses run', value: String(status.analysesRun) },
              {
                label: 'What you get',
                value: 'Values with their printed ranges, cross-report comparison, findings, urgency',
              },
              {
                label: 'Does not do',
                value: 'Train a model, diagnose, or prescribe',
              },
            ]}
          />
          <div className="form-actions">
            <Link className="btn btn--primary" to="/medical-reports">
              <Icon name="activity" size={16} /> Upload reports and analyse
            </Link>
          </div>
          <p className="card__footnote">
            A value is called abnormal only when its own report printed a reference range
            it falls outside. A number with no range is left unjudged.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Side by side"
          subtitle="The same word — &ldquo;report&rdquo; — means different things to each pipeline."
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>MRI / CT volumes</th>
                <th>Medical reports</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>What the file contains</td>
                <td>Voxel intensities in 3D</td>
                <td>Text and numbers on a page</td>
              </tr>
              <tr>
                <td>Trains the model?</td>
                <td>Yes — this is the training data</td>
                <td>No — there is nothing to learn from</td>
              </tr>
              <tr>
                <td>Matching file needed</td>
                <td>Yes, a _seg mask per volume</td>
                <td>No — reports stand alone</td>
              </tr>
              <tr>
                <td>Result</td>
                <td>Trained weights, Dice, loss per round</td>
                <td>Extracted values, comparison, findings, urgency</td>
              </tr>
              <tr>
                <td>Doctor involvement</td>
                <td>Not a diagnosis; a segmentation model</td>
                <td>Draft for a consultation, never a diagnosis</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Other pages" subtitle="For setting up and inspecting the rest." />
        <ul className="notice__list">
          <li>
            <Link to="/hospitals">Hospitals</Link> — the simulated sites a dataset is
            assigned to before training.
          </li>
          <li>
            <Link to="/training">Training</Link> — federated rounds and configuration.
          </li>
          <li>
            <Link to="/model-results">Model Results</Link> — measured metrics from any run
            that has completed.
          </li>
          <li>
            <Link to="/case-intake">Case Intake</Link> — mixed files in one upload, with an
            honest per-file classification.
          </li>
          <li>
            <Link to="/privacy-security">Privacy &amp; Security</Link> — which mechanisms
            are implemented, and which are in effect.
          </li>
        </ul>
      </Card>
    </div>
  );
}
