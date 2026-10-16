// Hospital list with working search, status filter and sortable columns.
// The same component powers the Hospitals page (full toolbar) and the Dashboard
// overview (compact, no toolbar), so the table markup exists only once.

import { useMemo, useState } from 'react';
import type { Hospital } from '../types';
import {
  Card,
  CardHeader,
  StatList,
} from './Card';
import { Icon } from './Icon';
import { Button } from './Button';
import { EmptyState } from './States';
import {
  StatusBadge,
  datasetStatusBadge,
  hospitalStatusBadge,
  localTrainingBadge,
} from './StatusBadge';
import { SelectField, TextField } from './FormControls';

export type SortKey = 'name' | 'status' | 'studies' | 'lastSync' | 'localTraining';
export type SortDirection = 'asc' | 'desc';

export interface HospitalTableProps {
  hospitals: Hospital[];
  onSelect?: (hospital: Hospital) => void;
  /** Hides the search / filter / sort toolbar. */
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

const STATUS_WEIGHT: Record<string, number> = { online: 0, degraded: 1, offline: 2 };
const TRAINING_WEIGHT: Record<string, number> = { training: 0, idle: 1, complete: 2, failed: 3 };

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Short label for charts with a narrow axis, e.g. "St. Aurelia University
 * Hospital" -> "St. Aurelia". Keeping the second word when the first ends in a
 * full stop avoids the meaningless "St." that plain word-splitting produced.
 */
export function shortHospitalName(hospital: Hospital): string {
  const words = hospital.name.split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return hospital.id;
  if (first.endsWith('.') && words[1]) return `${first} ${words[1]}`;
  return first;
}

export function HospitalTable({
  hospitals,
  onSelect,
  compact = false,
  title = 'Hospital participation',
  subtitle,
}: HospitalTableProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'degraded' | 'offline'>(
    'all',
  );
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = hospitals.filter((hospital) => {
      const matchesQuery =
        needle.length === 0 ||
        [hospital.name, hospital.id, hospital.location, hospital.nodeId]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      const matchesStatus = statusFilter === 'all' || hospital.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'status':
          result = (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9);
          break;
        case 'localTraining':
          result = (TRAINING_WEIGHT[a.localTraining] ?? 9) - (TRAINING_WEIGHT[b.localTraining] ?? 9);
          break;
        case 'studies':
          result = a.studies - b.studies;
          break;
        case 'lastSync':
          result = new Date(a.lastSync).getTime() - new Date(b.lastSync).getTime();
          break;
        default:
          result = a.name.localeCompare(b.name);
      }
      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [hospitals, query, statusFilter, sortKey, sortDirection]);

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (key: SortKey): string => {
    if (key !== sortKey) return '';
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  const toolbar = compact ? null : (
    <div className="toolbar">
      <div className="toolbar__search">
        <TextField
          id="hospital-search"
          label="Search hospitals"
          type="search"
          value={query}
          onChange={setQuery}
          placeholder="Name, ID, location or node address"
          hint="Filters the table as you type."
        />
      </div>
      <div className="toolbar__filter">
        <SelectField
          id="hospital-status-filter"
          label="Connection status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'online', label: 'Online' },
            { value: 'degraded', label: 'Degraded' },
            { value: 'offline', label: 'Offline' },
          ]}
        />
      </div>
      <div className="toolbar__filter">
        <SelectField
          id="hospital-sort"
          label="Sort by"
          value={sortKey}
          onChange={(value) => {
            setSortKey(value);
            setSortDirection('asc');
          }}
          options={[
            { value: 'name', label: 'Name (A-Z)' },
            { value: 'status', label: 'Connection status' },
            { value: 'studies', label: 'Dataset size' },
            { value: 'lastSync', label: 'Last synchronisation' },
            { value: 'localTraining', label: 'Local training state' },
          ]}
        />
      </div>
    </div>
  );

  const header = (
    <CardHeader
      title={title}
      subtitle={
        subtitle ??
        (compact
          ? undefined
          : `Showing ${rows.length} of ${hospitals.length} simulated nodes.${
              statusFilter !== 'all' ? ` Filtered by ${statusFilter}.` : ''
            }`)
      }
    />
  );

  return (
    <Card>
      {header}
      {toolbar}
      {rows.length === 0 ? (
        <EmptyState
          title="No hospitals match"
          description="No simulated node matches the current search text and status filter. Clear the filters to see all three nodes."
          icon="hospital"
          action={
            <Button
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">
              Simulated hospital nodes, their connection status and local datasets
            </caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={sortKey === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="table__sort" onClick={() => toggleSort('name')}>
                    Hospital{sortIndicator('name')}
                  </button>
                </th>
                <th scope="col" aria-sort={sortKey === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="table__sort" onClick={() => toggleSort('status')}>
                    Connection{sortIndicator('status')}
                  </button>
                </th>
                <th scope="col">Dataset</th>
                <th scope="col" aria-sort={sortKey === 'lastSync' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="table__sort" onClick={() => toggleSort('lastSync')}>
                    Last sync{sortIndicator('lastSync')}
                  </button>
                </th>
                <th scope="col" aria-sort={sortKey === 'localTraining' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="table__sort" onClick={() => toggleSort('localTraining')}>
                    Local training{sortIndicator('localTraining')}
                  </button>
                </th>
                <th scope="col">Rounds</th>
                {onSelect ? (
                  <th scope="col">
                    <span className="visually-hidden">Details</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((hospital) => {
                const connection = hospitalStatusBadge(hospital.status);
                const dataset = datasetStatusBadge(hospital.datasetStatus);
                const training = localTrainingBadge(hospital.localTraining);
                return (
                  <tr key={hospital.id} className={onSelect ? 'table__row--clickable' : undefined}>
                    <th scope="row" data-label="Hospital" className="table__name">
                      <span className="table__name-main">{hospital.name}</span>
                      <span className="table__name-meta">
                        {hospital.id} &middot; {hospital.nodeId}
                      </span>
                    </th>
                    <td data-label="Connection">
                      <StatusBadge tone={connection.tone}>{connection.label}</StatusBadge>
                    </td>
                    <td data-label="Dataset">
                      <div className="table__stack">
                        <StatusBadge tone={dataset.tone}>{dataset.label}</StatusBadge>
                        <span className="table__meta">
                          {hospital.studies} studies &middot; {hospital.sizeGb} GB
                        </span>
                      </div>
                    </td>
                    <td data-label="Last sync" className="table__nowrap">
                      {formatDateTime(hospital.lastSync)}
                    </td>
                    <td data-label="Local training">
                      <StatusBadge tone={training.tone}>{training.label}</StatusBadge>
                    </td>
                    <td data-label="Rounds" className="table__nowrap">
                      {hospital.roundsContributed}
                    </td>
                    {onSelect ? (
                      <td data-label="Details" className="table__action">
                        <Button
                          size="sm"
                          onClick={() => onSelect(hospital)}
                          aria-label={`View details for ${hospital.name}`}
                        >
                          Details
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Key/value detail block used inside the hospital details dialog. */
export function HospitalDetails({ hospital }: { hospital: Hospital }): React.JSX.Element {
  const connection = hospitalStatusBadge(hospital.status);
  const dataset = datasetStatusBadge(hospital.datasetStatus);
  const training = localTrainingBadge(hospital.localTraining);

  return (
    <div className="detail">
      <div className="detail__badges">
        <StatusBadge tone={connection.tone}>{connection.label}</StatusBadge>
        <StatusBadge tone={dataset.tone}>Dataset: {dataset.label}</StatusBadge>
        <StatusBadge tone={training.tone}>Local training: {training.label}</StatusBadge>
      </div>

      <StatList
        columns={2}
        items={[
          { label: 'Hospital ID', value: hospital.id },
          { label: 'Flower node address', value: <code>{hospital.nodeId}</code> },
          { label: 'Location', value: hospital.location },
          { label: 'Local studies', value: `${hospital.studies} studies` },
          { label: 'Dataset size', value: `${hospital.sizeGb} GB` },
          { label: 'Data split', value: hospital.split },
          { label: 'Last synchronisation', value: formatDateTime(hospital.lastSync) },
          { label: 'Rounds contributed', value: `${hospital.roundsContributed} of 8` },
          {
            label: 'Privacy budget used',
            value: `\u03B5 = ${hospital.privacyBudgetUsed.toFixed(2)} (simulated)`,
          },
        ]}
      />

      <div className="detail__notes">
        <h3 className="detail__notes-title">
          <Icon name="info" size={16} /> Notes
        </h3>
        <p>{hospital.notes}</p>
      </div>

      <div className="detail__row">
        <Button
          variant="secondary"
          disabled
          disabledReason="Local training cannot be started from the dashboard: the federated backend is not implemented yet (Stage 2)."
        >
          Start local training
        </Button>
        <Button
          variant="secondary"
          disabled
          disabledReason="Synchronisation requires the Flower server, which is not implemented yet (Stage 2)."
        >
          Synchronise now
        </Button>
      </div>
    </div>
  );
}
