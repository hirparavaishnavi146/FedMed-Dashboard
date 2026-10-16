// Privacy & Security page.
//
// Honesty is the whole point of this page: nothing here is implemented. Every
// control is disabled with the reason, and every status says "not implemented"
// or "simulated" rather than implying working cryptography.
//
// Live mode reads GET /api/v1/security/status; demo mode reads the frontend
// sample module. Both say the same thing: no mechanism is implemented.

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, ProgressBar, StatList } from '../components/Card';
import { NumberField, SelectField, SwitchField, TextField } from '../components/FormControls';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { FeatureStateCard } from '../components/FeatureStateCard';
import { StatusBadge, severityBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { ComparisonBarChart } from '../components/TrainingChart';
import { formatDateTime } from '../components/HospitalTable';
import { DEMO_SECURITY_STATUS } from '../data/demo';
import { useApiResource } from '../hooks/useApiResource';
import { api, IS_DEMO_MODE } from '../services/api';
import type { SecurityStatus } from '../types';

type TabId = 'overview' | 'mechanisms' | 'audit';
type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

export function PrivacySecurityPage(): React.JSX.Element {
  const security = useApiResource<SecurityStatus>(api.securityStatus, DEMO_SECURITY_STATUS);

  const [tab, setTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [query, setQuery] = useState('');
  const [noiseMultiplier, setNoiseMultiplier] = useState(
    DEMO_SECURITY_STATUS.differentialPrivacy.noiseMultiplier,
  );
  const [clippingNorm, setClippingNorm] = useState(
    DEMO_SECURITY_STATUS.differentialPrivacy.clippingNorm,
  );
  const [targetEpsilon, setTargetEpsilon] = useState(
    DEMO_SECURITY_STATUS.differentialPrivacy.targetEpsilon,
  );

  const data = security.data;
  const events = data?.events ?? [];
  const mechanisms = data?.mechanisms ?? [];
  const budgets = data?.budgets ?? [];
  // The real feature states, straight from the API. Never inferred from a switch.
  const features = data?.features ?? [];
  const enabledCount = features.filter((feature) => feature.state === 'enabled').length;
  const accountedEpsilon = data?.privacyAccounting?.epsilon ?? null;

  // Adopt the values the API reports once they arrive.
  useEffect(() => {
    if (!data) return;
    setNoiseMultiplier(data.differentialPrivacy.noiseMultiplier);
    setClippingNorm(data.differentialPrivacy.clippingNorm);
    setTargetEpsilon(data.differentialPrivacy.targetEpsilon);
  }, [data]);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((event) => {
        const matchesSeverity = severityFilter === 'all' || event.severity === severityFilter;
        const matchesQuery =
          needle.length === 0 ||
          [event.category, event.message, event.source].join(' ').toLowerCase().includes(needle);
        return matchesSeverity && matchesQuery;
      });
  }, [events, severityFilter, query]);

  const warningCount = events.filter((event) => event.severity !== 'info').length;

  if (security.loading) {
    return (
      <div className="page">
        <PageHeader title="Privacy &amp; Security" description="Loading configuration and audit log." />
        <LoadingState label="Loading privacy configuration" />
      </div>
    );
  }

  if (security.error) {
    return (
      <div className="page">
        <PageHeader title="Privacy &amp; Security" description="Configuration could not be loaded." />
        <ErrorState
          message={security.error}
          hint="Start the FastAPI backend, or set VITE_USE_DEMO_DATA=true in frontend/.env."
          onRetry={security.reload}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader title="Privacy &amp; Security" description="No configuration is available." />
        <ErrorState
          message="The security endpoint returned no payload."
          onRetry={security.reload}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Privacy &amp; Security"
        description="What is implemented, what is configured, and what is actually in effect right now."
        action={
          enabledCount > 0 ? (
            <StatusBadge tone="success">
              {enabledCount} OF {data.mechanismsTotal} ENABLED
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">NONE ENABLED</StatusBadge>
          )
        }
      />

      <Notice tone="info" title="What is implemented, and what is in effect" icon="info">
        A feature is shown as <strong>Enabled</strong> only when the API reports it as implemented,
        configured, and in effect for this process. A switch being on is never the reason. The
        &ldquo;Observed&rdquo; line on each card is the evidence the API returned.
        {IS_DEMO_MODE
          ? ' Demo mode is on, so nothing can be observed — every feature reports Not configured rather than guessing.'
          : ' These states come from the running API, not from the frontend.'}
      </Notice>

      <Notice tone="warning" title="This application is not production-secure" icon="warning">
        It has not been penetration tested or independently reviewed. Differential privacy and secure
        aggregation are implemented and tested but have not been exercised on a live run, and
        homomorphic encryption is not implemented at all.
      </Notice>

      <div className="metrics metrics--4">
        <MetricCard
          label="Mechanisms implemented"
          value={String(data.mechanismsImplemented)}
          unit={`of ${data.mechanismsTotal}`}
          icon="privacy"
          footnote="Code exists in the repository and is covered by tests. Not the same as enabled."
        />
        <MetricCard
          label="In effect now"
          value={String(enabledCount)}
          unit={`of ${data.mechanismsTotal}`}
          icon="lock"
          footnote="Implemented, configured and observed as active in this process."
        />
        <MetricCard
          label="Accounted epsilon"
          value={
            accountedEpsilon === null || accountedEpsilon === undefined
              ? 'not measured'
              : `\u03B5 ${accountedEpsilon.toFixed(3)}`
          }
          icon="shield"
          footnote={
            accountedEpsilon === null || accountedEpsilon === undefined
              ? 'Differential privacy is not configured, so no epsilon has been spent. Shown as absent rather than zero.'
              : `Client-level DP against a target of ${(data.privacyAccounting?.delta ?? 0) === 0 ? '' : `delta ${data.privacyAccounting?.delta?.toExponential(0)}`}.`
          }
        />
        <MetricCard
          label="Audit entries"
          value={String(events.length)}
          unit={data.audit?.recorded ? 'recorded' : 'none'}
          icon="activity"
          footnote={
            data.audit?.recorded
              ? `${warningCount} recorded as warnings. Recorded by this process; lost on restart.`
              : 'No audit log is attached, or nothing has been recorded yet.'
          }
        />
      </div>

      <Tabs
        idPrefix="privacy"
        active={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Configuration overview' },
          { id: 'mechanisms', label: 'Mechanisms', count: mechanisms.length },
          { id: 'audit', label: 'Security events', count: events.length },
        ]}
      />

      {tab === 'overview' ? (
        <TabPanel idPrefix="privacy" id="overview">
          <Card>
            <CardHeader
              title="Feature state"
              subtitle="Reported by the running API. Enabled means implemented, configured and in effect — never 'the switch is on'."
            />
            {features.length === 0 ? (
              <p className="card__footnote">
                No feature states were returned. The security status endpoint did not report them.
              </p>
            ) : (
              features.map((feature) => (
                <FeatureStateCard
                  key={feature.id}
                  name={feature.name}
                  state={feature.state}
                  implemented={feature.implemented}
                  description={feature.description}
                  evidence={feature.evidence}
                  requirements={feature.requirements}
                  reference={feature.reference}
                />
              ))
            )}
          </Card>

          <div className="grid grid--sidebar">
            <Card>
              <CardHeader
                title="Differential privacy configuration"
                subtitle="Configures the mechanism in app/federated/privacy.py. Nothing here is applied to a run yet."
              />
              <div className="form-grid">
                <SelectField
                  id="dp-mechanism"
                  label="Noise mechanism"
                  value={data.differentialPrivacy.mechanism}
                  onChange={() => undefined}
                  options={[
                    {
                      value: data.differentialPrivacy.mechanism,
                      label: data.differentialPrivacy.mechanism,
                    },
                  ]}
                  hint="Planned: Gaussian noise added to clipped client updates."
                />
                <NumberField
                  id="dp-noise"
                  label="Noise multiplier"
                  value={noiseMultiplier}
                  onChange={setNoiseMultiplier}
                  min={0}
                  max={5}
                  step={0.1}
                  hint="Larger values mean more privacy and lower accuracy."
                />
                <NumberField
                  id="dp-clip"
                  label="Gradient clipping norm"
                  value={clippingNorm}
                  onChange={setClippingNorm}
                  min={0.1}
                  max={10}
                  step={0.1}
                  hint="Bounds each client's contribution before noise is added."
                />
                <NumberField
                  id="dp-epsilon"
                  label="Target epsilon"
                  value={targetEpsilon}
                  onChange={setTargetEpsilon}
                  min={0.1}
                  max={10}
                  step={0.1}
                  hint="Privacy budget to aim for across the whole run."
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="primary"
                  icon={<Icon name="check" size={16} />}
                  disabled
                  disabledReason="There is no privacy engine to apply these settings to (planned for milestone M5)."
                >
                  Apply privacy settings
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setNoiseMultiplier(data.differentialPrivacy.noiseMultiplier);
                    setClippingNorm(data.differentialPrivacy.clippingNorm);
                    setTargetEpsilon(data.differentialPrivacy.targetEpsilon);
                  }}
                >
                  Reset fields
                </Button>
              </div>
              <p className="card__footnote">
                The fields are editable so the intended configuration can be reviewed. The values are not
                stored and are not used by anything.
              </p>
            </Card>

            <div className="stack">
              <Card>
                <CardHeader title="Secure aggregation" subtitle="Planned behaviour, not built" />
                <StatList
                  columns={1}
                  items={[
                    {
                      label: 'Status',
                      value: (
                        <StatusBadge tone={data.secureAggregationEnabled ? 'success' : 'danger'}>
                          {data.secureAggregationEnabled ? 'Enabled' : 'Not implemented'}
                        </StatusBadge>
                      ),
                    },
                    { label: 'Minimum clients', value: '3 nodes (design target)' },
                    {
                      label: 'Masking scheme',
                      value: 'Pairwise masking with a server-side cancellation (planned)',
                    },
                    {
                      label: 'Server visibility',
                      value: 'Would see only the aggregate, never a single update',
                    },
                  ]}
                />
                <SwitchField
                  id="secagg-enable"
                  label="Enable secure aggregation"
                  checked={false}
                  onChange={() => undefined}
                  disabled
                  disabledReason="No masking code exists in the project yet."
                  hint="Would hide individual updates from the server."
                />
              </Card>

              <Card>
                <CardHeader title="Privacy budget per node" subtitle="Simulated epsilon usage" />
                {budgets.length === 0 ? (
                  <p className="card__footnote">No budgets are reported.</p>
                ) : (
                  budgets.map((budget) => (
                    <ProgressBar
                      key={budget.hospitalId}
                      label={`${budget.hospitalId} \u03B5 = ${budget.epsilon.toFixed(2)}`}
                      value={(budget.epsilon / Math.max(targetEpsilon, 0.1)) * 100}
                      tone={budget.epsilon > targetEpsilon ? 'danger' : 'success'}
                    />
                  ))
                )}
                <p className="card__footnote">
                  Bars compare simulated usage with the target epsilon above. No real accounting is
                  performed.
                </p>
              </Card>
            </div>
          </div>

          <ComparisonBarChart
            title="Epsilon usage per node"
            subtitle="Simulated values against a target budget"
            ariaLabel="Bar chart of simulated epsilon usage per hospital node"
            points={budgets.map((budget) => ({
              label: budget.hospitalId,
              value: budget.epsilon,
              color: budget.epsilon > targetEpsilon ? '#b91c1c' : '#0d7d72',
            }))}
          />
        </TabPanel>
      ) : null}

      {tab === 'mechanisms' ? (
        <TabPanel idPrefix="privacy" id="mechanisms">
          <div className="grid grid--2">
            {mechanisms.map((mechanism) => (
              <Card key={mechanism.id}>
                <CardHeader
                  title={mechanism.name}
                  subtitle={mechanism.reference}
                  action={
                    <StatusBadge tone={mechanism.implemented ? 'success' : 'danger'}>
                      {mechanism.implemented
                        ? 'Implemented'
                        : mechanism.state === 'simulated'
                          ? 'Simulated only'
                          : 'Not implemented'}
                    </StatusBadge>
                  }
                />
                <p className="card__body-text">{mechanism.description}</p>
                <SwitchField
                  id={`mech-${mechanism.id}`}
                  label={`Enable ${mechanism.name.toLowerCase()}`}
                  checked={false}
                  onChange={() => undefined}
                  disabled
                  disabledReason="This mechanism has not been implemented or tested."
                  hint="Disabled until the mechanism exists and has tests."
                />
              </Card>
            ))}
          </div>
        </TabPanel>
      ) : null}

      {tab === 'audit' ? (
        <TabPanel idPrefix="privacy" id="audit">
          <Card>
            <CardHeader
              title="Security events"
              subtitle={`${filteredEvents.length} of ${events.length} simulated entries. No real audit log is written yet.`}
            />
            <div className="toolbar">
              <div className="toolbar__search">
                <TextField
                  id="audit-search"
                  label="Search events"
                  type="search"
                  value={query}
                  onChange={setQuery}
                  placeholder="Category, message or source"
                  hint="Filters the audit table below."
                />
              </div>
              <div className="toolbar__filter">
                <SelectField<SeverityFilter>
                  id="audit-severity"
                  label="Severity"
                  value={severityFilter}
                  onChange={setSeverityFilter}
                  options={[
                    { value: 'all', label: 'All severities' },
                    { value: 'info', label: 'Info' },
                    { value: 'warning', label: 'Warning' },
                    { value: 'critical', label: 'Critical' },
                  ]}
                />
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="state state--empty">
                <h3 className="state__title">No events match</h3>
                <p className="state__description">
                  No simulated audit entry matches the current search text and severity filter.
                </p>
                <div className="state__action">
                  <Button
                    onClick={() => {
                      setQuery('');
                      setSeverityFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Simulated security and privacy events</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Category</th>
                      <th scope="col">Event</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => {
                      const badge = severityBadge(event.severity);
                      return (
                        <tr key={event.id}>
                          <td data-label="Time" className="table__nowrap">
                            {formatDateTime(event.timestamp)}
                          </td>
                          <td data-label="Severity">
                            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                          </td>
                          <td data-label="Category">{event.category}</td>
                          <td data-label="Event">{event.message}</td>
                          <td data-label="Source">
                            <code>{event.source}</code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      ) : null}
    </div>
  );
}
