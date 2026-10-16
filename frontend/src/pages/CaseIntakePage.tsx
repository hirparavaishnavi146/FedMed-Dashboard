// Case intake page.
//
// Accepts a mixed set of files for one case — an MRI volume, a written report, a
// 2D X-ray — and shows what each one actually is and what could genuinely be done
// with it.
//
// WHAT THIS PAGE DELIBERATELY DOES NOT DO
// It does not produce a diagnosis, a clinical impression, or a "suggestion" about
// the patient. Nothing in this project can read a 2D X-ray or a written report, and
// the only trained model has seen nothing but synthetic phantoms, so any suggestion
// would be invented. What it gives instead is an honest account: the report's own
// words under the report's own headings, the measured output of the real model where
// it applies, the basic facts of an image it cannot analyse, and an explicit reason
// wherever something was not done.
//
// The heading of every case says "not a diagnosis". That is not decoration: it is
// the correct description of what is on screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, StatList } from '../components/Card';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { api, ApiError, IS_DEMO_MODE } from '../services/api';
import { DEMO_CASE, DEMO_CASE_CAPABILITIES } from '../data/demoCase';
import type { CaseCapabilities, CaseFile, CaseSummary } from '../types';

const EMPTY_CAPABILITIES: CaseCapabilities = {
  mriVolume: { accepted: [], note: '' },
  reportPdf: { accepted: [], note: '' },
  reportText: { accepted: [], note: '' },
  image2d: { accepted: [], note: '' },
  dicom: { accepted: [], note: '' },
};

/** Presentation for each file kind. Never implies an interpretation was made. */
const KIND_INFO: Record<string, { label: string; icon: 'model' | 'info' | 'warning' | 'database'; tone: string }> = {
  'mri-volume': { label: 'MRI volume (3D)', icon: 'model', tone: 'Volume' },
  'report-pdf': { label: 'Report (PDF)', icon: 'info', tone: 'Document' },
  'report-text': { label: 'Report (text)', icon: 'info', tone: 'Document' },
  '2d-image': { label: '2D image', icon: 'warning', tone: 'Not analysable' },
  dicom: { label: 'DICOM', icon: 'warning', tone: 'Not supported' },
  archive: { label: 'Archive', icon: 'warning', tone: 'Not supported' },
  unsupported: { label: 'Unrecognised', icon: 'warning', tone: 'Not supported' },
};

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

/** Read one nested value out of a free-form analysis mapping. */
function analysisValue<T>(file: CaseFile, path: string): T | undefined {
  const segments = path.split('.');
  let current: unknown = file.analysis;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current as T | undefined;
}

function FileCard({ file }: { file: CaseFile }): React.JSX.Element {
  const info = KIND_INFO[file.kind] ?? KIND_INFO.unsupported;
  const reason = analysisValue<string>(file, 'reason');
  const note = analysisValue<string>(file, 'note');
  const sections = analysisValue<{ heading: string; text: string }[]>(file, 'sections') ?? [];
  const headings = analysisValue<string[]>(file, 'headingsFound') ?? [];
  const status = analysisValue<string>(file, 'status');
  const width = analysisValue<number>(file, 'width');
  const height = analysisValue<number>(file, 'height');
  const segmentation = analysisValue<Record<string, unknown>>(file, 'segmentation');
  const validation = analysisValue<Record<string, unknown>>(file, 'validation');

  return (
    <Card>
      <CardHeader
        title={file.name}
        subtitle={`${info.label} · ${formatBytes(file.sizeBytes)} · identified by ${file.method}`}
        action={
          file.analysed ? (
            <StatusBadge tone="success">ANALYSED</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">NOT ANALYSED</StatusBadge>
          )
        }
      />

      <p className="card__footnote">{file.note}</p>

      {/* --- report: the document's own words, under its own headings --- */}
      {sections.length > 0 ? (
        <div className="issue-list">
          {sections.map((section) => (
            <div className="issue" key={section.heading}>
              <Icon name="info" size={16} />
              <span>
                <strong>{section.heading}</strong>
                <br />
                {section.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {status === 'extracted' && sections.length === 0 ? (
        <div className="issue">
          <Icon name="info" size={16} />
          <span>{analysisValue<string>(file, 'excerpt')}</span>
        </div>
      ) : null}

      {status === 'no-text-layer' ? (
        <Notice tone="warning" title="This document cannot be read" icon="warning">
          {note}
        </Notice>
      ) : null}

      {/* --- 2D image: facts only, and why nothing more --- */}
      {width !== undefined && height !== undefined ? (
        <>
          <StatList
            items={[
              { label: 'Dimensions', value: `${width} x ${height} px` },
              { label: 'Colour mode', value: String(analysisValue<string>(file, 'mode') ?? '-') },
              { label: 'Format', value: String(analysisValue<string>(file, 'format') ?? '-') },
              { label: 'Pixel spacing', value: 'not stated in the file' },
            ]}
          />
          <Notice tone="warning" title="No analysis was performed" icon="warning">
            {reason}
          </Notice>
        </>
      ) : null}

      {/* --- MRI: validation plus the real model, with its provenance --- */}
      {validation ? (
        <>
          <StatList
            items={[
              {
                label: 'Geometry',
                value: (validation.imageShape as number[] | undefined)?.join(' x ') ?? '-',
              },
              {
                label: 'Voxel size (mm)',
                value: (validation.spacing as number[] | undefined)?.map((v) => v.toFixed(2)).join(' x ') ?? '-',
              },
              {
                label: 'Validation',
                value: validation.valid ? 'passed' : 'has errors',
              },
              {
                label: 'Mask supplied',
                value: validation.labelShape ? 'yes' : 'no (normal for a new scan)',
              },
            ]}
          />
          {note ? <p className="card__footnote">{note}</p> : null}
        </>
      ) : null}

      {segmentation ? (
        segmentation.available ? (
          <>
            <div className="metrics metrics--4">
              <MetricCard
                label="Segmented volume"
                value={Number(segmentation.volumeMm3 ?? 0).toFixed(0)}
                unit="mm³"
                icon="model"
                footnote={`${segmentation.foregroundVoxels} foreground voxels.`}
              />
              <MetricCard
                label="Dice vs your mask"
                value={
                  segmentation.diceAgainstReference === null ||
                  segmentation.diceAgainstReference === undefined
                    ? 'not measured'
                    : Number(segmentation.diceAgainstReference).toFixed(4)
                }
                icon="activity"
                footnote={
                  segmentation.referenceMaskSupplied
                    ? 'Measured against the mask you supplied.'
                    : 'No mask supplied, so there is nothing to score against.'
                }
              />
              <MetricCard
                label="Model"
                value={String(segmentation.architecture ?? 'U-Net')}
                icon="model"
                footnote={`${segmentation.parameters ?? '?'} parameters, threshold ${segmentation.threshold}.`}
              />
              <MetricCard
                label="Meaningful here?"
                value={segmentation.meaningfulOnRealData ? 'Yes' : 'No'}
                icon="warning"
                footnote={String(segmentation.provenance ?? '')}
              />
            </div>
          </>
        ) : (
          <Notice tone="warning" title="Segmentation was not run" icon="warning">
            {String(segmentation.reason ?? '')}
          </Notice>
        )
      ) : null}

      {headings.length > 0 ? (
        <p className="card__footnote">
          Headings found in the document: {headings.join(', ')}
        </p>
      ) : null}
    </Card>
  );
}

export function CaseIntakePage(): React.JSX.Element {
  const [tab, setTab] = useState<'intake' | 'files' | 'capabilities'>('intake');

  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [capabilities, setCapabilities] = useState<CaseCapabilities>(EMPTY_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [directoryPath, setDirectoryPath] = useState('');
  const [caseName, setCaseName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (IS_DEMO_MODE) {
      setCapabilities(DEMO_CASE_CAPABILITIES);
      setCaseData(DEMO_CASE);
      setLoading(false);
      return;
    }
    try {
      const caps = await api.caseCapabilities();
      setCapabilities(caps);
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

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(readableError(caught));
    } finally {
      setBusy(null);
    }
  };

  const onUpload = (files: FileList | null) =>
    run('upload', async () => {
      if (!files || files.length === 0) return;
      const result = await api.intakeCase(Array.from(files), caseName.trim() || undefined);
      setCaseData(result);
      setTab('files');
      if (fileInput.current) fileInput.current.value = '';
    });

  const onDirectory = () =>
    run('directory', async () => {
      if (!directoryPath.trim()) return;
      const result = await api.intakeCaseDirectory(
        directoryPath.trim(),
        caseName.trim() || undefined,
      );
      setCaseData(result);
      setTab('files');
    });

  if (loading) return <LoadingState label="Loading case intake" />;
  if (error) {
    return (
      <div className="page">
        <PageHeader title="Case Intake" description="Mixed file intake and case summary." />
        <ErrorState
          message="Could not load case intake"
          hint={error}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Case Intake"
        description="Send a case — MRI volume, written report, 2D image — and see exactly which parts can be analysed and which cannot."
        action={<StatusBadge tone="warning">NOT A DIAGNOSIS</StatusBadge>}
      />

      <Notice tone="warning" title="This does not diagnose anything" icon="warning">
        {caseData?.interpretationReason ??
          'No component of this project can read a 2D X-ray or a written report, and its only model was trained on synthetic phantoms. A suggestion produced from these inputs would be invented, so none is produced.'}
      </Notice>

      {IS_DEMO_MODE ? (
        <Notice tone="info" title="Demo mode — sample case, no backend" icon="info">
          The dashboard is showing a labelled sample case and is not calling an API, so
          uploading is disabled. Set <code>VITE_USE_DEMO_DATA=false</code> with a running
          backend to analyse real files.
        </Notice>
      ) : null}

      {caseData ? (
        <div className="metrics metrics--4">
          <MetricCard
            label="Files received"
            value={String(caseData.fileCount)}
            icon="database"
            footnote={`${caseData.analysedCount} could be analysed.`}
          />
          <MetricCard
            label="MRI volumes"
            value={String(caseData.mriVolumeCount)}
            icon="model"
            footnote={`${caseData.maskCount} mask(s) supplied.`}
          />
          <MetricCard
            label="Reports"
            value={String(caseData.reportCount)}
            icon="info"
            footnote="Text is quoted verbatim; it is never interpreted."
          />
          <MetricCard
            label="2D images"
            value={String(caseData.image2dCount)}
            icon="warning"
            footnote="Described, never analysed: every model here consumes 3D volumes."
          />
        </div>
      ) : null}

      <Tabs
        idPrefix="case"
        active={tab}
        onChange={(next) => setTab(next as typeof tab)}
        items={[
          { id: 'intake', label: 'Send a case' },
          { id: 'files', label: 'Case files' },
          { id: 'capabilities', label: 'What is possible' },
        ]}
      />

      {tab === 'intake' ? (
        <TabPanel idPrefix="case" id="intake">
          <Card>
            <CardHeader
              title="One case, any mix of files"
              subtitle="Accepted: MRI volumes (.nii/.nii.gz), PDF or text reports, and 2D images. Each file is identified by its content, then reported on separately."
            />

            <div className="form-grid">
              <label className="field">
                <span className="field__label">Case name (optional)</span>
                <input
                  className="field__input"
                  type="text"
                  value={caseName}
                  placeholder="Example: case-2026-014"
                  onChange={(event) => setCaseName(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Server directory (alternative to uploading)</span>
                <input
                  className="field__input"
                  type="text"
                  value={directoryPath}
                  placeholder="D:\cases\case-2026-014"
                  onChange={(event) => setDirectoryPath(event.target.value)}
                />
                <span className="field__hint">
                  Read only. Useful for large volumes that are impractical to upload.
                </span>
              </label>
            </div>

            <div className="form-actions">
              <input
                ref={fileInput}
                id="case-upload"
                type="file"
                multiple
                className="visually-hidden"
                onChange={(event) => void onUpload(event.target.files)}
              />
              <Button
                variant="primary"
                icon="database"
                disabled={busy !== null || IS_DEMO_MODE}
                onClick={() => fileInput.current?.click()}
              >
                {busy === 'upload' ? 'Analysing...' : 'Choose files and analyse'}
              </Button>
              <Button
                icon="search"
                disabled={busy !== null || IS_DEMO_MODE || !directoryPath.trim()}
                onClick={() => void onDirectory()}
              >
                {busy === 'directory' ? 'Analysing...' : 'Analyse a server directory'}
              </Button>
            </div>

            {actionError ? (
              <Notice tone="warning" title="That did not work" icon="warning">
                {actionError}
              </Notice>
            ) : null}
          </Card>

          <Notice tone="info" title="Where your files go" icon="info">
            Files are processed on this server and are never sent anywhere else. They are
            held in a temporary staging directory that is swept by age and deleted when
            the case is removed. No dataset, report or image is committed to Git or
            written to public storage. Never upload identifiable patient data.
          </Notice>
        </TabPanel>
      ) : null}

      {tab === 'files' ? (
        <TabPanel idPrefix="case" id="files">
          {!caseData ? (
            <Card>
              <CardHeader
                title="No case analysed yet"
                subtitle="Send a case on the first tab, or press Refresh if one was analysed earlier."
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={caseData.name}
                  subtitle={`${caseData.fileCount} file(s) · ${caseData.analysedCount} analysed · case ${caseData.caseId}`}
                />
                <ul className="notice__list">
                  {caseData.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="card__footnote">{caseData.notice}</p>
              </Card>

              {caseData.files.map((file) => (
                <FileCard file={file} key={file.name} />
              ))}
            </>
          )}
        </TabPanel>
      ) : null}

      {tab === 'capabilities' ? (
        <TabPanel idPrefix="case" id="capabilities">
          <Card>
            <CardHeader
              title="What this project can do with each input"
              subtitle="Served by the API, so the page cannot describe a capability the code does not have."
            />
            {Object.entries(capabilities).map(([key, entry]) => (
              <div className="feature-state" key={key}>
                <div className="feature-state__head">
                  <span className="feature-state__name">
                    {KIND_INFO[key]?.label ?? key}
                  </span>
                  <StatusBadge tone={entry.accepted.length > 0 ? 'info' : 'warning'}>
                    {entry.accepted.length > 0 ? entry.accepted.join(' ') : 'NOT ACCEPTED'}
                  </StatusBadge>
                </div>
                <p className="feature-state__description">{entry.note}</p>
              </div>
            ))}
          </Card>

          <Notice tone="warning" title="What this is not" icon="warning">
            This is a research prototype. It is not a medical device, it has not been
            clinically validated, and it must not be used for diagnosis or patient care.
            The segmentation model was trained only on procedurally generated synthetic
            phantoms, so its output on a real scan is not meaningful.
          </Notice>
        </TabPanel>
      ) : null}
    </div>
  );
}
