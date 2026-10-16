// Headline number card used on the dashboard and results pages.

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  /** Small line under the value: context, timestamp, or a caveat. */
  footnote?: string;
  /** Change versus the previous round. */
  delta?: {
    value: string;
    direction: 'up' | 'down' | 'flat';
    /** Whether the change is desirable, which is not always "up". */
    good: boolean;
  };
  extra?: ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  footnote,
  delta,
  extra,
}: MetricCardProps): React.JSX.Element {
  return (
    <article className="metric-card">
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        {icon ? (
          <span className="metric-card__icon" aria-hidden="true">
            <Icon name={icon} size={20} />
          </span>
        ) : null}
      </div>

      <div className="metric-card__value-row">
        <span className="metric-card__value">{value}</span>
        {unit ? <span className="metric-card__unit">{unit}</span> : null}
      </div>

      {delta ? (
        <span
          className={`metric-card__delta metric-card__delta--${
            delta.good ? 'good' : 'bad'
          }`}
        >
          <Icon
            name={delta.direction === 'up' ? 'expand' : delta.direction === 'down' ? 'collapse' : 'activity'}
            size={14}
          />
          {delta.value}
          <span className="metric-card__delta-note">
            {delta.direction === 'flat' ? 'no change' : 'vs previous round'}
          </span>
        </span>
      ) : null}

      {extra}

      {footnote ? <p className="metric-card__footnote">{footnote}</p> : null}
    </article>
  );
}
