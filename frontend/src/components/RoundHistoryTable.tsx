// Table of federated rounds. Shared by the Training page and the Model Results
// page so the round history is rendered by one implementation only.
//
// There is no "status" column any more: a row exists only once a round has been
// aggregated, so it is either a measurement or a seeded placeholder, and the
// Provenance column says which. The old status column was also the thing that
// let a seeded row be rendered as though it had completed.

import { useMemo, useState } from 'react';
import type { FederatedRound } from '../types';
import { Card, CardHeader } from './Card';
import { EmptyState } from './States';
import { StatusBadge } from './StatusBadge';
import { SelectField } from './FormControls';
import { formatDateTime } from './HospitalTable';

export interface RoundHistoryTableProps {
  rounds: FederatedRound[];
  title?: string;
  subtitle?: string;
  showFilter?: boolean;
}

export function RoundHistoryTable({
  rounds,
  title = 'Round history',
  subtitle,
  showFilter = true,
}: RoundHistoryTableProps): React.JSX.Element {
  const [minRound, setMinRound] = useState<'all' | '5' | '7'>('all');

  const rows = useMemo(() => {
    const sorted = [...rounds].sort((a, b) => b.round - a.round);
    if (minRound === 'all') return sorted;
    return sorted.filter((round) => round.round >= Number(minRound));
  }, [rounds, minRound]);

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={
          subtitle ??
          `${rows.length} of ${rounds.length} rounds shown, newest first. ` +
            (rounds.length > 0 && rounds.every((round) => round.measured)
              ? 'All measured by a real run.'
              : 'Illustrative values, not measurements.')
        }
        action={
          showFilter ? (
            <div className="card__filter">
              <SelectField
                id="round-history-filter"
                label="From round"
                value={minRound}
                onChange={setMinRound}
                options={[
                  { value: 'all', label: 'All rounds' },
                  { value: '5', label: 'Round 5 onwards' },
                  { value: '7', label: 'Round 7 onwards' },
                ]}
              />
            </div>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No rounds to show"
          description="No federated round matches the selected filter."
          icon="training"
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Federated round history with aggregated metrics</caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">Provenance</th>
                <th scope="col">Clients</th>
                <th scope="col">Aggregated loss</th>
                <th scope="col">Val. loss</th>
                <th scope="col">Val. Dice</th>
                <th scope="col">Duration</th>
                <th scope="col">Finished</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((round) => (
                <tr key={round.round}>
                  <th scope="row" data-label="Round">
                    #{round.round}
                  </th>
                  <td data-label="Provenance">
                    {round.measured ? (
                      <StatusBadge tone="success">Measured</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Illustrative</StatusBadge>
                    )}
                  </td>
                  <td data-label="Clients">
                    {round.participants} / {round.expectedParticipants}
                    {round.excludedClients.length > 0 ? (
                      <span className="table__meta"> ({round.excludedClients.length} excluded)</span>
                    ) : null}
                  </td>
                  <td data-label="Aggregated loss">{round.aggregatedLoss.toFixed(3)}</td>
                  <td data-label="Val. loss">
                    {round.aggregatedValidationLoss === null
                      ? '—'
                      : round.aggregatedValidationLoss.toFixed(3)}
                  </td>
                  <td data-label="Val. Dice">
                    {round.aggregatedValidationDice === null
                      ? '—'
                      : round.aggregatedValidationDice.toFixed(3)}
                  </td>
                  <td data-label="Duration">
                    {Math.floor(round.durationSeconds / 60)}m{' '}
                    {Math.round(round.durationSeconds % 60)}s
                  </td>
                  <td data-label="Finished" className="table__nowrap">
                    {formatDateTime(round.finishedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
