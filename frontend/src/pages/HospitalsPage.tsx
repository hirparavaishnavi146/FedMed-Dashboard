// Hospitals page: the three simulated research nodes.
// No real hospital connection exists. Every value is sample data.

import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader, ProgressBar, StatList } from '../components/Card';
import { HospitalDetails, HospitalTable, formatDateTime, shortHospitalName } from '../components/HospitalTable';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ErrorState, LoadingState, Notice } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabPanel } from '../components/Tabs';
import { ComparisonBarChart } from '../components/TrainingChart';
import { DEMO_EXPLANATION, DEMO_HOSPITALS } from '../data/demo';
import { useApiResource } from '../hooks/useApiResource';
import { api } from '../services/api';
import type { Hospital } from '../types';

type TabId = 'all' | 'online' | 'attention';

export function HospitalsPage(): React.JSX.Element {
  const hospitals = useApiResource<Hospital[]>(
    api.hospitals,
    DEMO_HOSPITALS,
    (value) => value.length === 0,
  );

  const [tab, setTab] = useState<TabId>('all');
  const [selected, setSelected] = useState<Hospital | null>(null);

  const online = DEMO_HOSPITALS.filter((hospital) => hospital.status === 'online');
  const attention = DEMO_HOSPITALS.filter((hospital) => hospital.status !== 'online');
  const visible = useMemo(() => {
    if (tab === 'online') return online;
    if (tab === 'attention') return attention;
    return DEMO_HOSPITALS;
  }, [tab, online, attention]);

  const totalStudies = DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.studies, 0);
  const totalGb = DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.sizeGb, 0);
  const averageBudget =
    DEMO_HOSPITALS.reduce((sum, hospital) => sum + hospital.privacyBudgetUsed, 0) / DEMO_HOSPITALS.length;

  if (hospitals.loading) {
    return (
      <div className="page">
        <PageHeader title="Hospitals" description="Loading simulated nodes." />
        <LoadingState label="Loading hospital nodes" />
      </div>
    );
  }

  if (hospitals.error) {
    return (
      <div className="page">
        <PageHeader title="Hospitals" description="The node list could not be loaded." />
        <ErrorState
          message={hospitals.error}
          hint="The FastAPI backend is not running. Set VITE_USE_DEMO_DATA=true in frontend/.env to work offline."
          onRetry={hospitals.reload}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Hospitals"
        description="Simulated research nodes that would hold their own MRI data locally."
        action={
          <Button
            icon={<Icon name="refresh" size={16} />}
            onClick={hospitals.reload}
            disabled
            disabledReason="Node synchronisation needs the Flower server, which is not implemented yet (Stage 2)."
          >
            Synchronise all nodes
          </Button>
        }
      />

      <Notice tone="demo" title="Three simulated nodes - no real hospital is connected">
        {DEMO_EXPLANATION} Node addresses, study counts and privacy budgets below are invented for
        interface development. No patient information is present anywhere in this project.
      </Notice>

      <div className="metrics metrics--4">
        <MetricCard
          label="Nodes online"
          value={`${online.length}`}
          unit={`of ${DEMO_HOSPITALS.length}`}
          icon="network"
          footnote={`${attention.length} node needs attention.`}
        />
        <MetricCard
          label="Synthetic studies"
          value={totalStudies.toLocaleString()}
          icon="database"
          footnote={`${totalGb.toFixed(1)} GB of phantom volumes in total.`}
        />
        <MetricCard
          label="Average privacy budget"
          value={`\u03B5 ${averageBudget.toFixed(2)}`}
          icon="lock"
          footnote="Simulated epsilon usage. No differential privacy is implemented yet."
        />
        <MetricCard
          label="Rounds with all nodes"
          value="7 of 8"
          icon="activity"
          footnote="Round 6 ran with 2 of 3 nodes reporting."
        />
      </div>

      <Tabs
        idPrefix="hospitals"
        active={tab}
        onChange={setTab}
        items={[
          { id: 'all', label: 'All nodes', count: DEMO_HOSPITALS.length },
          { id: 'online', label: 'Online', count: online.length },
          { id: 'attention', label: 'Needs attention', count: attention.length },
        ]}
      />

      <TabPanel idPrefix="hospitals" id={tab}>
        <HospitalTable
          hospitals={visible}
          onSelect={setSelected}
          title="Hospital nodes"
          subtitle={
            tab === 'all'
              ? 'Search, filter and sort the simulated nodes. Select Details for the full record.'
              : `Filtered by the "${tab === 'online' ? 'Online' : 'Needs attention'}" tab.`
          }
        />
      </TabPanel>

      <div className="grid grid--2">
        {attention.length > 0 ? (
          <Card>
            <CardHeader
              title="Nodes needing attention"
              subtitle="Simulated issues that would block a federated round"
            />
            <ul className="issue-list">
              {attention.map((hospital) => (
                <li className="issue-list__item" key={hospital.id}>
                  <div className="issue-list__head">
                    <span className="issue-list__name">{hospital.name}</span>
                    <StatusBadge tone={hospital.status === 'degraded' ? 'warning' : 'danger'}>
                      {hospital.status === 'degraded' ? 'Degraded' : 'Offline'}
                    </StatusBadge>
                  </div>
                  <p className="issue-list__detail">{hospital.notes}</p>
                  <dl className="issue-list__meta">
                    <div>
                      <dt>Last sync</dt>
                      <dd>{formatDateTime(hospital.lastSync)}</dd>
                    </div>
                    <div>
                      <dt>Local training</dt>
                      <dd>{hospital.localTraining}</dd>
                    </div>
                  </dl>
                  <Button size="sm" onClick={() => setSelected(hospital)}>
                    View details
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="stack">
          <ComparisonBarChart
            title="Local dataset size"
            subtitle="Synthetic studies per node, in gigabytes"
            ariaLabel="Bar chart comparing local dataset size per hospital node"
            unit=" GB"
            points={DEMO_HOSPITALS.map((hospital) => ({
              label: shortHospitalName(hospital),
              value: hospital.sizeGb,
              color: hospital.status === 'online' ? '#0b3b5c' : '#f59e0b',
            }))}
          />
          <Card>
            <CardHeader title="Node readiness" subtitle="Share of rounds each node contributed to" />
            {DEMO_HOSPITALS.map((hospital) => (
              <ProgressBar
                key={hospital.id}
                label={`${hospital.id} - ${hospital.name}`}
                value={(hospital.roundsContributed / 8) * 100}
                tone={hospital.status === 'online' ? 'success' : 'warning'}
              />
            ))}
          </Card>
        </div>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={
          selected ? `${selected.id} - simulated node, not a real hospital connection` : undefined
        }
        footer={
          <Button onClick={() => setSelected(null)}>Close</Button>
        }
      >
        {selected ? <HospitalDetails hospital={selected} /> : null}
        {selected ? (
          <StatList
            columns={1}
            items={[
              {
                label: 'Data policy',
                value: 'Synthetic phantom volumes only. No real patient data is stored or transmitted.',
              },
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
