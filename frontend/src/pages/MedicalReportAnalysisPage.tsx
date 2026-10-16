// Medical Report Analysis — AI-assisted clinical decision support.
//
// WHAT THIS PAGE IS
// A workflow for uploading one to three reports for one patient, extracting the facts
// from them, comparing them, and producing a structured draft to help the patient or
// clinician prepare for a consultation.
//
// WHAT IT IS NOT, AND HOW THAT IS ENFORCED RATHER THAN JUST LABELLED
// It is not a diagnosis. The backend splits its output in two and this page keeps
// that split visible:
//   * measured facts (extracted values, ranges printed in the report, comparison) are
//     computed and shown as facts, with the report and page they came from;
//   * generated text (possible complications, clinical suggestions, the narrative
//     summary) comes from an optional AI provider and is shown only when that provider
//     is configured. When it is not, the section says so instead of showing a
//     plausible-looking paragraph with no model behind it.
// An emergency notice, when the backend raises one, is rendered ABOVE everything else.
//
// Print and "Save as PDF" both use the browser's own print dialog. There is no
// client-side PDF generator here, and the buttons say what they actually do.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, StatList } from '../components/Card';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { api, ApiError, IS_DEMO_MODE } from '../services/api';
import { DEMO_MEDICAL_ANALYSIS } from '../data/demoMedical';
import type {
  MedicalAnalysis,
  MedicalReportHealth,
  ReportSession,
} from '../types';

const MAX_REPORTS = 3;

const EMPTY_HEALTH: MedicalReportHealth = {
  available: false,
  ai: { configured: false, provider: null, model: null, reason: null },
  ocr: {
    availableForImages: false,
    availableForPdfs: false,
    engineInstalled: false,
    engineDetail: '',
    reason: null,
    installHint: '',
  },
  maxReports: MAX_REPORTS,
  maxFileBytes: 0,
  acceptedTypes: [],
  authRequired: true,
  note: '',
  publicDemoMode: false,
  publicDemoWarning: null,
};

function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

const URGENCY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  emergency: 'danger',
  'prompt-review': 'warning',
  'routine-review': 'info',
  'unable-to-assess': 'neutral',
};

const URGENCY_LABEL: Record<string, string> = {
  emergency: 'EMERGENCY',
  'prompt-review': 'PROMPT REVIEW',
  'routine-review': 'ROUTINE REVIEW',
  'unable-to-assess': 'UNABLE TO ASSESS',
};

/** One of the three report slots. */
function ReportSlot({
  index,
  report,
  busy,
  onPick,
  onRemove,
  disabled,
}: {
  index: number;
  report: { name: string; status: string; characters: number; pages: number | null; ocrUsed: boolean } | null;
  busy: boolean;
  onPick: (files: FileList | null) => void;
  onRemove: () => void;
  disabled: boolean;
}): React.JSX.Element {
  const inputId = `report-slot-${index}`;
  const input = useRef<HTMLInputElement | null>(null);

  return (
    <div className="feature-state report-slot" data-state={report ? 'set' : 'empty'}>
      <div className="feature-state__head">
        <span className="feature-state__name">Report {index + 1}</span>
        {report ? (
          <StatusBadge tone={report.status === 'extracted' ? 'success' : 'warning'}>
            {report.status === 'extracted' ? 'TEXT EXTRACTED' : 'NOT READABLE'}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">EMPTY</StatusBadge>
        )}
      </div>

      {report ? (
        <>
          <p className="feature-state__description">{report.name}</p>
          <StatList
            items={[
              { label: 'Characters', value: String(report.characters) },
              { label: 'Pages', value: report.pages === null ? 'n/a' : String(report.pages) },
              { label: 'Read by OCR', value: report.ocrUsed ? 'yes' : 'no' },
            ]}
          />
          <div className="form-actions">
            <input
              ref={input}
              id={inputId}
              type="file"
              className="visually-hidden"
              accept=".pdf,.txt,.md,.text,.png,.jpg,.jpeg,.bmp,.tif"
              onChange={(event) => onPick(event.target.files)}
            />
            <Button
              icon="refresh"
              disabled={busy || disabled}
              onClick={() => input.current?.click()}
            >
              Replace
            </Button>
            <Button icon="close" variant="danger" disabled={busy || disabled} onClick={onRemove}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="feature-state__description">
            Drop a file here, or choose one. PDF, text, PNG or JPEG.
          </p>
          <div
            className="drop-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!busy && !disabled) onPick(event.dataTransfer.files);
            }}
          >
            <input
              ref={input}
              id={inputId}
              type="file"
              className="visually-hidden"
              accept=".pdf,.txt,.md,.text,.png,.jpg,.jpeg,.bmp,.tif"
              onChange={(event) => onPick(event.target.files)}
            />
            <Button
              icon="database"
              disabled={busy || disabled}
              onClick={() => input.current?.click()}
            >
              Choose a report
            </Button>
            <span className="card__footnote">or drag and drop onto this panel</span>
          </div>
        </>
      )}
    </div>
  );
}

export function MedicalReportAnalysisPage(): React.JSX.Element {
  const [tab, setTab] = useState<'upload' | 'extracted' | 'compare' | 'analysis'>('upload');

  const [health, setHealth] = useState<MedicalReportHealth>(EMPTY_HEALTH);
  const [session, setSession] = useState<ReportSession | null>(null);
  const [analysis, setAnalysis] = useState<MedicalAnalysis | null>(null);
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (IS_DEMO_MODE) {
      // No backend, and this feature cannot run against sample files: the API is the
      // thing that reads them. The sample analysis is shown, clearly labelled, with
      // the upload controls disabled.
      setHealth({
        ...EMPTY_HEALTH,
        available: true,
        note: 'Demo mode: showing a labelled sample analysis. The real workflow requires a running backend and an API key.',
      });
      setAnalysis(DEMO_MEDICAL_ANALYSIS);
      setLoading(false);
      return;
    }
    try {
      setHealth(await api.medicalReportHealth());
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

  const ensureSession = async (): Promise<ReportSession> => {
    if (session) return session;
    const created = await api.createReportSession();
    setSession(created);
    return created;
  };

  const onUpload = (index: number, files: FileList | null) =>
    run(`upload-${index}`, async () => {
      if (!files || files.length === 0) return;
      const current = await ensureSession();
      const result = await api.uploadReports(current.sessionId, Array.from(files));
      setSession(await api.reportSession(current.sessionId));
      const parts: string[] = [];
      if (result.accepted.length) {
        parts.push(`Accepted: ${result.accepted.map((item) => item.name).join(', ')}.`);
      }
      if (result.rejected.length) {
        parts.push(
          `Rejected: ${result.rejected.map((item) => `${item.name} (${item.reason})`).join('; ')}.`,
        );
      }
      setUploadNotes(parts.join(' ') || 'Nothing was uploaded.');
    });

  const onRemove = (index: number) =>
    run(`remove-${index}`, async () => {
      // Removing a report means starting the session again: the API holds the reports,
      // and a partial removal would leave the comparison covering a different set than
      // the user believes.
      if (!session) return;
      await api.deleteReportSession(session.sessionId);
      setSession(null);
      setAnalysis(null);
      setComparison(null);
      setUploadNotes(
        'Session cleared, including the uploaded files. Upload the reports you want to compare.',
      );
    });

  const onConfirm = (confirmed: boolean) =>
    run('confirm', async () => {
      const current = await ensureSession();
      setSession(await api.confirmSamePatient(current.sessionId, confirmed));
    });

  const onCompare = () =>
    run('compare', async () => {
      if (!session) return;
      const result = await api.compareReports(session.sessionId);
      setComparison(result.comparison as unknown as Record<string, unknown>);
      setTab('compare');
    });

  const onAnalyze = () =>
    run('analyze', async () => {
      if (!session) return;
      const result = await api.analyzeReports(session.sessionId);
      setAnalysis(result);
      setTab('analysis');
    });

  if (loading) return <LoadingState label="Loading medical report analysis" />;
  if (error) {
    return (
      <div className="page">
        <PageHeader title="Medical Report Analysis" description="Clinical decision support." />
        <ErrorState
          message="Could not reach the report-analysis service"
          hint={error}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const reports = session?.reports ?? [];
  const urgent = analysis?.urgency;
  const canCompare = reports.length >= 1 && session?.samePatientConfirmed === true;
  const canAnalyse = canCompare;

  return (
    <div className="page">
      {/* Emergency notice FIRST, before anything else on the page. */}
      {urgent?.showBeforeAnalysis && urgent.emergencyNotice ? (
        <div className="emergency-banner" role="alert">
          <Icon name="warning" size={22} />
          <div>
            <strong>Possible emergency warning signs found</strong>
            <p>{urgent.emergencyNotice}</p>
          </div>
        </div>
      ) : null}

      <PageHeader
        title="Medical Report Analysis"
        description="Upload up to three reports for one patient, extract the facts, compare them, and prepare a structured draft for a consultation."
        action={
          <StatusBadge tone="warning">NOT A DIAGNOSIS</StatusBadge>
        }
      />

      <Notice tone="warning" title="This does not diagnose, and it does not replace a doctor" icon="warning">
        It is an AI-assisted draft to help you understand your reports and prepare
        questions for a qualified healthcare professional. It is not clinically
        validated. If you think you may be having a medical emergency, contact emergency
        services now — do not wait for this page.
      </Notice>

      {/* This is about the deployment, not the analysis: an anonymous visitor is being
          allowed to upload here. They are entitled to know before they choose a file. */}
      {health.publicDemoMode ? (
        <div className="public-demo-banner" role="alert">
          <Icon name="warning" size={22} />
          <div>
            <strong>Public demo — anyone can upload to this server</strong>
            <p>
              {health.publicDemoWarning ??
                'This server accepts report uploads from anyone, with no API key. Use synthetic examples only, and never upload a real patient\u2019s report here.'}
            </p>
          </div>
        </div>
      ) : null}

      {IS_DEMO_MODE ? (
        <Notice tone="info" title="Demo mode — sample analysis, no backend" icon="info">
          Uploading is disabled because there is no backend to read the files. The
          sample analysis below is labelled data, and the generated sections are marked
          as such. Set <code>VITE_USE_DEMO_DATA=false</code> with a running backend and
          an API key to analyse real reports.
        </Notice>
      ) : null}

      <div className="grid grid--sidebar">
        <Card>
          <CardHeader title="What the server can do" subtitle="Reported by the API, so the page cannot overstate it." />
          <StatList
            items={[
              {
                label: 'AI provider',
                value: health.ai.configured
                  ? `configured (${health.ai.model ?? 'default'})`
                  : 'not configured',
              },
              {
                label: 'OCR engine',
                value: health.ocr.engineInstalled ? 'installed' : 'not installed',
              },
              {
                label: 'OCR for PDFs',
                value: health.ocr.availableForPdfs ? 'available' : 'unavailable',
              },
              { label: 'Max reports', value: String(health.maxReports) },
              {
                label: 'Max file size',
                value: health.maxFileBytes ? formatBytes(health.maxFileBytes) : 'n/a',
              },
              { label: 'API key required', value: health.authRequired ? 'yes' : 'no' },
            ]}
          />
          {!health.ai.configured ? (
            <Notice tone="warning" title="The generated sections are unavailable" icon="warning">
              {health.ai.reason ??
                'No AI provider is configured, so no narrative summary, possible complications or clinical suggestions can be produced. The extracted values and the comparison still work. No placeholder analysis is invented in their place.'}
            </Notice>
          ) : null}
          {!health.ocr.engineInstalled && health.ocr.installHint ? (
            <p className="card__footnote">{health.ocr.installHint}</p>
          ) : null}
          <p className="card__footnote">{health.note}</p>
        </Card>

        <Card>
          <CardHeader title="Reports in this session" subtitle="Up to three, for the same patient." />
          <div className="metrics metrics--4">
            <MetricCard
              label="Uploaded"
              value={String(reports.length)}
              unit={`of ${health.maxReports}`}
              icon="database"
              footnote="One patient per session."
            />
            <MetricCard
              label="Same patient confirmed"
              value={session?.samePatientConfirmed ? 'Yes' : 'No'}
              icon="check"
              footnote="Comparing reports from different people would be meaningless."
            />
            <MetricCard
              label="Readable"
              value={String(reports.filter((item) => item.status === 'extracted').length)}
              icon="info"
              footnote="Reports that produced text."
            />
            <MetricCard
              label="Unreadable"
              value={String(reports.filter((item) => item.status !== 'extracted').length)}
              icon="warning"
              footnote="Not the same as empty: the text could not be read."
            />
          </div>
        </Card>
      </div>

      {actionError ? (
        <Notice tone="warning" title="That did not work" icon="warning">
          {actionError}
        </Notice>
      ) : null}

      <Tabs
        idPrefix="mr"
        active={tab}
        onChange={(next) => setTab(next as typeof tab)}
        items={[
          { id: 'upload', label: 'Upload reports' },
          { id: 'extracted', label: 'Extracted information' },
          { id: 'compare', label: 'Comparison' },
          { id: 'analysis', label: 'Analysis' },
        ]}
      />

      {/* ---------------- upload ---------------- */}
      {tab === 'upload' ? (
        <TabPanel idPrefix="mr" id="upload">
          {Array.from({ length: MAX_REPORTS }).map((_, index) => {
            const report = reports[index] ?? null;
            return (
              <ReportSlot
                key={index}
                index={index}
                report={report}
                busy={busy !== null}
                disabled={IS_DEMO_MODE}
                onPick={(files) => void onUpload(index, files)}
                onRemove={() => void onRemove(index)}
              />
            );
          })}

          {uploadNotes ? (
            <Notice tone="info" title="Upload result" icon="info">
              {uploadNotes}
            </Notice>
          ) : null}

          <Card>
            <CardHeader
              title="Before comparing"
              subtitle="Confirm the reports are for the same patient. This is required, not optional."
            />
            <label className="field">
              <span className="field__label">
                <input
                  type="checkbox"
                  checked={session?.samePatientConfirmed ?? false}
                  disabled={reports.length === 0 || IS_DEMO_MODE || busy !== null}
                  onChange={(event) => void onConfirm(event.target.checked)}
                />{' '}
                These reports all belong to the same patient
              </span>
              <span className="field__hint">
                Comparing reports from different patients would produce a meaningless
                result, so the API refuses to compare or analyse until this is confirmed.
              </span>
            </label>

            <div className="form-actions">
              <Button
                icon="search"
                disabled={!canCompare || IS_DEMO_MODE || busy !== null}
                onClick={() => void onCompare()}
                title={
                  reports.length === 0
                    ? 'Upload at least one report.'
                    : !session?.samePatientConfirmed
                      ? 'Confirm the reports are for the same patient first.'
                      : undefined
                }
              >
                {busy === 'compare' ? 'Comparing...' : 'Compare reports'}
              </Button>
              <Button
                variant="primary"
                icon="activity"
                disabled={!canAnalyse || IS_DEMO_MODE || busy !== null}
                onClick={() => void onAnalyze()}
                title={
                  reports.length === 0
                    ? 'Upload at least one report.'
                    : !session?.samePatientConfirmed
                      ? 'Confirm the reports are for the same patient first.'
                      : undefined
                }
              >
                {busy === 'analyze' ? 'Analysing...' : 'Analyse reports'}
              </Button>
              <Button
                icon="close"
                variant="danger"
                disabled={!session || IS_DEMO_MODE || busy !== null}
                onClick={() => void onRemove(0)}
              >
                Discard session and files
              </Button>
            </div>
            {busy ? (
              <p className="card__footnote">
                <Icon name="clock" size={14} /> Working — this can take a few seconds per
                report.
              </p>
            ) : null}
          </Card>

          <Notice tone="info" title="Where your files go" icon="info">
            Reports are read on this server and stored in a temporary staging directory
            that is deleted when you discard the session. They are not sent anywhere else
            <strong> unless </strong>
            an AI provider is configured, in which case the extracted text of the reports
            is sent to that provider for the analysis step — the health panel above states
            whether one is in use. Never upload identifiable patient information to a
            provider without the appropriate authorisation and safeguards.
          </Notice>
        </TabPanel>
      ) : null}

      {/* ---------------- extracted ---------------- */}
      {tab === 'extracted' ? (
        <TabPanel idPrefix="mr" id="extracted">
          {reports.length === 0 ? (
            <Card>
              <CardHeader
                title="No reports uploaded"
                subtitle="Upload reports on the first tab to see what was extracted from them."
              />
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.reportId}>
                <CardHeader
                  title={report.name}
                  subtitle={`${report.status} · ${report.characters} characters · ${report.pages ?? 'n/a'} page(s)`}
                  action={
                    report.status === 'extracted' ? (
                      <StatusBadge tone="success">READ</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">NOT READABLE</StatusBadge>
                    )
                  }
                />
                {report.headingsFound.length ? (
                  <p className="card__footnote">
                    Headings found: {report.headingsFound.join(', ')}
                  </p>
                ) : null}
                {report.extractNote ? <p className="card__footnote">{report.extractNote}</p> : null}

                {report.pageTexts.length ? (
                  <details className="card__details">
                    <summary className="card__details-summary">
                      Extracted text — check every value against the original
                    </summary>
                    {report.pageTexts.map((text, index) => (
                      <pre className="code-block" key={index}>
                        {`[page ${index + 1}]

${text}`}
                      </pre>
                    ))}
                  </details>
                ) : null}
              </Card>
            ))
          )}
        </TabPanel>
      ) : null}

      {/* ---------------- compare ---------------- */}
      {tab === 'compare' ? (
        <TabPanel idPrefix="mr" id="compare">
          {!comparison ? (
            <Card>
              <CardHeader
                title="No comparison yet"
                subtitle="Upload reports, confirm they are for the same patient, then press Compare reports."
              />
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Comparison across reports"
                subtitle={String(comparison.note ?? '')}
              />
              {(['consistentFindings', 'differingFindings', 'findingsInOneReportOnly'] as const).map(
                (key) => {
                  const rows = (comparison[key] as Record<string, unknown>[]) ?? [];
                  if (!rows.length) return null;
                  return (
                    <div key={key}>
                      <h4 className="card__subtitle">
                        {key === 'consistentFindings'
                          ? 'Consistent across reports'
                          : key === 'differingFindings'
                            ? 'Differs between reports'
                            : 'In one report only'}
                      </h4>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Analyte</th>
                              <th>Appears in</th>
                              <th>Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, index) => (
                              <tr key={index}>
                                <td>{String(row.analyte ?? '')}</td>
                                <td>
                                  {Array.isArray(row.presentIn)
                                    ? (row.presentIn as string[]).join(', ')
                                    : ''}
                                </td>
                                <td>{String(row.note ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                },
              )}
              {Array.isArray(comparison.missingInformation) &&
              (comparison.missingInformation as string[]).length ? (
                <>
                  <h4 className="card__subtitle">Missing information</h4>
                  <ul className="notice__list">
                    {(comparison.missingInformation as string[]).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>
          )}
        </TabPanel>
      ) : null}

      {/* ---------------- analysis ---------------- */}
      {tab === 'analysis' ? (
        <TabPanel idPrefix="mr" id="analysis">
          {!analysis ? (
            <Card>
              <CardHeader
                title="No analysis yet"
                subtitle="Upload reports, confirm the patient, then press Analyse reports."
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Analysis"
                  subtitle={`${analysis.reportCount} report(s) · ${analysis.analysisId}`}
                  action={
                    <StatusBadge tone={URGENCY_TONE[analysis.urgency.category] ?? 'neutral'}>
                      {URGENCY_LABEL[analysis.urgency.category] ?? analysis.urgency.category}
                    </StatusBadge>
                  }
                />
                <p className="card__footnote">{analysis.urgency.basis}</p>
                <p className="card__footnote">{analysis.urgency.limitation}</p>
                <div className="form-actions no-print">
                  <Button icon="database" onClick={() => window.print()}>
                    Print
                  </Button>
                  <Button icon="database" onClick={() => window.print()}>
                    Save as PDF
                  </Button>
                </div>
                <p className="card__footnote no-print">
                  Both buttons open your browser&apos;s print dialog. To save a file,
                  choose &ldquo;Save as PDF&rdquo; as the destination there — this page
                  does not generate a PDF itself.
                </p>
              </Card>

              {/* A. Summary */}
              <Card>
                <CardHeader
                  title="A. Summary of reports"
                  subtitle={String(analysis.summary.note ?? '')}
                />
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Values found</th>
                        <th>Outside printed range</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.summary.deterministicDigest.map((row) => (
                        <tr key={row.reportName}>
                          <td>{row.reportName}</td>
                          <td>{row.reportType}</td>
                          <td>{row.reportDate ?? 'not found in the report'}</td>
                          <td>{row.valuesFound}</td>
                          <td>{row.valuesOutsidePrintedRange}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {analysis.ai.available && Array.isArray(analysis.ai.data.reportSummaries) ? (
                  <>
                    <h4 className="card__subtitle">AI summary (generated, unverified)</h4>
                    {(analysis.ai.data.reportSummaries as Record<string, unknown>[]).map(
                      (item, index) => (
                        <div className="issue" key={index}>
                          <Icon name="info" size={16} />
                          <span>
                            <strong>{String(item.reportName ?? '')}</strong>
                            <br />
                            {String(item.plainSummary ?? '')}
                            <br />
                            <em>{Array.isArray(item.citations) ? (item.citations as string[]).join(' ') : ''}</em>
                          </span>
                        </div>
                      ),
                    )}
                  </>
                ) : null}
              </Card>

              {/* B. Findings */}
              <Card>
                <CardHeader
                  title="B. Findings and abnormalities"
                  subtitle="Computed from the report text. Every entry cites the report and page it came from."
                />
                {analysis.findings.length === 0 ? (
                  <p className="card__footnote">
                    No value was outside the reference range its own report printed, and no
                    statement appeared under a diagnosis heading. This is only about what
                    these reports contain — it is not a clean bill of health.
                  </p>
                ) : (
                  <div className="issue-list">
                    {analysis.findings.map((finding, index) => (
                      <div
                        className={`issue issue--${finding.direction ? 'error' : 'warning'}`}
                        key={index}
                      >
                        <Icon name={finding.direction ? 'warning' : 'info'} size={16} />
                        <span>
                          <strong>{finding.finding}</strong>{' '}
                          <StatusBadge tone={finding.documentedOrInferred === 'documented' ? 'info' : 'warning'}>
                            {finding.documentedOrInferred}
                          </StatusBadge>
                          <br />
                          <em>
                            {finding.reportName}
                            {finding.reportDate ? ` · ${finding.reportDate}` : ''}
                            {finding.page ? ` · page ${finding.page}` : ''}
                          </em>
                          <br />
                          {finding.referenceRange
                            ? `Reference range printed in the report: ${finding.referenceRange}`
                            : 'No reference range was printed with this value.'}
                          <br />
                          {finding.whyItMayMatter}
                          <br />
                          <small>Source: {finding.sourceSnippet}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* C. Possible complications */}
              <Card>
                <CardHeader
                  title="C. Possible complications"
                  subtitle="This section requires an AI provider. It is never derived from a template."
                />
                {analysis.possibleComplications.available ? (
                  <>
                    <p className="card__footnote">{analysis.possibleComplications.note}</p>
                    {analysis.possibleComplications.items.map((item, index) => (
                      <div className="feature-state" key={index}>
                        <div className="feature-state__head">
                          <span className="feature-state__name">
                            {String(item.complication ?? '')}
                          </span>
                          <StatusBadge tone="warning">
                            POSSIBILITY, NOT A DIAGNOSIS
                          </StatusBadge>
                        </div>
                        <StatList
                          items={[
                            { label: 'Confidence', value: String(item.confidence ?? 'not stated') },
                            {
                              label: 'Suggested urgency',
                              value: String(item.recommendedUrgency ?? 'not stated'),
                            },
                            {
                              label: 'Evidence',
                              value: Array.isArray(item.evidence)
                                ? (item.evidence as string[]).join(' | ')
                                : 'none given',
                            },
                            {
                              label: 'Contradictory findings',
                              value: Array.isArray(item.contradictoryFindings) && (item.contradictoryFindings as string[]).length
                                ? (item.contradictoryFindings as string[]).join(' | ')
                                : 'none stated',
                            },
                            {
                              label: 'Missing information',
                              value: Array.isArray(item.missingInformation) && (item.missingInformation as string[]).length
                                ? (item.missingInformation as string[]).join(' | ')
                                : 'none stated',
                            },
                            { label: 'Confidence limits', value: String(item.confidenceLimitations ?? '') },
                          ]}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <Notice tone="warning" title="Unavailable" icon="warning">
                    {analysis.possibleComplications.reason}
                  </Notice>
                )}
              </Card>

              {/* D. Diagnosis status */}
              <Card>
                <CardHeader
                  title="D. Diagnosis status"
                  subtitle="What the reports state, and what cannot be determined. No AI in this section."
                />
                <p className="card__footnote">{analysis.diagnosisStatus.explanation}</p>
                <StatList
                  items={[{ label: 'Status', value: analysis.diagnosisStatus.status }]}
                />
                {analysis.diagnosisStatus.documentedDiagnoses.map((item, index) => (
                  <div className="issue" key={index}>
                    <Icon name="info" size={16} />
                    <span>
                      <strong>{item.heading}</strong> — {item.reportName}
                      {item.page ? ` · page ${item.page}` : ''}
                      <br />
                      {item.text}
                    </span>
                  </div>
                ))}
              </Card>

              {/* E. Clinical suggestions */}
              <Card>
                <CardHeader
                  title="E. Clinical suggestions"
                  subtitle="Requires an AI provider. Never treatment advice."
                />
                {analysis.clinicalSuggestions.available ? (
                  <>
                    <ul className="notice__list">
                      {analysis.clinicalSuggestions.items.map((item, index) => (
                        <li key={index}>
                          {String(item.suggestion ?? '')}{' '}
                          <em>({String(item.category ?? '')})</em>
                        </li>
                      ))}
                    </ul>
                    <p className="card__footnote">{analysis.clinicalSuggestions.note}</p>
                  </>
                ) : (
                  <Notice tone="warning" title="Unavailable" icon="warning">
                    {analysis.clinicalSuggestions.reason}
                  </Notice>
                )}
              </Card>

              {/* F. Urgency */}
              <Card>
                <CardHeader
                  title="F. Urgency and safety"
                  subtitle="A keyword scan of the report text. It cannot clear a case."
                />
                <StatList
                  items={[
                    { label: 'Category', value: URGENCY_LABEL[analysis.urgency.category] ?? '' },
                    { label: 'Basis', value: analysis.urgency.basis },
                  ]}
                />
                {analysis.urgency.redFlags.length ? (
                  <div className="issue-list">
                    {analysis.urgency.redFlags.map((flag, index) => (
                      <div className="issue issue--error" key={index}>
                        <Icon name="warning" size={16} />
                        <span>
                          <strong>{flag.term}</strong> — {flag.provenance.reportName}
                          {flag.provenance.page ? ` · page ${flag.provenance.page}` : ''}
                          <br />
                          <small>{flag.provenance.snippet}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <ul className="notice__list">
                  {Object.entries(analysis.urgency.categoriesExplained).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}</strong>: {value}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* G. Doctor-ready summary */}
              <Card>
                <CardHeader
                  title="G. Doctor-ready summary"
                  subtitle="AI-generated summary for clinician review"
                />
                {analysis.doctorReadySummary.available && analysis.doctorReadySummary.ai ? (
                  <>
                    {Object.entries(analysis.doctorReadySummary.ai).map(([key, value]) => (
                      <div key={key}>
                        <h4 className="card__subtitle">{key}</h4>
                        <ul className="notice__list">
                          {(Array.isArray(value) ? value : [value]).map((entry, index) => (
                            <li key={index}>{String(entry)}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                ) : (
                  <Notice tone="warning" title="The AI-generated summary is unavailable" icon="warning">
                    {analysis.doctorReadySummary.reason}
                  </Notice>
                )}
                <h4 className="card__subtitle">Assembled from the report text (not AI)</h4>
                <StatList
                  items={[
                    {
                      label: 'Reports provided',
                      value: (
                        (analysis.doctorReadySummary.assembledForClinician
                          .reportsProvided as string[]) ?? []
                      ).join(', '),
                    },
                    {
                      label: 'Unreadable reports',
                      value:
                        (
                          (analysis.doctorReadySummary.assembledForClinician
                            .unreadableReports as string[]) ?? []
                        ).join(', ') || 'none',
                    },
                  ]}
                />
              </Card>

              <Notice tone="warning" title="Safety disclaimer" icon="warning">
                {analysis.safetyDisclaimer}
              </Notice>
            </>
          )}
        </TabPanel>
      ) : null}
    </div>
  );
}
