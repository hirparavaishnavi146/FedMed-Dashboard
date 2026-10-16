// Charts. Recharts is wrapped here so every chart in the app shares the same
// palette, grid, tooltip and axis behaviour, and so pages never repeat
// chart configuration.

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetricPoint } from '../types';
import { Card, CardHeader } from './Card';
import { EmptyState } from './States';

export interface ChartSeries {
  key: keyof MetricPoint;
  label: string;
  color: string;
  /** Loss values are usually drawn with a dashed line. */
  dashed?: boolean;
}

interface BaseChartProps {
  title: string;
  subtitle?: string;
  data: MetricPoint[];
  series: ChartSeries[];
  /** Wording for screen readers and when data is empty. */
  ariaLabel: string;
  height?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  action?: React.ReactNode;
  /** Render the plot only, without the surrounding card. Used when a page supplies its own card. */
  bare?: boolean;
}

const AXIS_PROPS = {
  stroke: '#94a3b8',
  tick: { fill: '#64748b', fontSize: 12 },
  tickLine: false,
} as const;

function ChartShell({
  title,
  subtitle,
  data,
  series,
  ariaLabel,
  height = 280,
  action,
  bare = false,
  children,
}: BaseChartProps & { children: (data: MetricPoint[]) => React.ReactNode }): React.JSX.Element {
  const body =
    data.length === 0 ? (
      <EmptyState
        title="No rounds recorded yet"
        description="The chart will appear once at least one federated round has completed."
        icon="activity"
      />
    ) : (
      <div className="chart" role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children(data) as React.ReactElement}
        </ResponsiveContainer>
      </div>
    );

  const legend = (
    <ul className="chart__legend-text">
      {series.map((entry) => (
        <li key={String(entry.key)}>
          <span className="chart__swatch" style={{ background: entry.color }} aria-hidden="true" />
          {entry.label}
        </li>
      ))}
    </ul>
  );

  if (bare) {
    return (
      <>
        {body}
        {legend}
      </>
    );
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      {body}
      {legend}
    </Card>
  );
}

/** Line chart, used for loss and Dice curves over federated rounds. */
export function TrainingChart(props: BaseChartProps): React.JSX.Element {
  const { series, yDomain = ['auto', 'auto'] } = props;
  return (
    <ChartShell {...props}>
      {(data) => (
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="round" {...AXIS_PROPS} label={undefined} />
          <YAxis domain={yDomain} {...AXIS_PROPS} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #dbe3ec',
              fontSize: 13,
              boxShadow: '0 6px 18px rgba(15, 42, 66, 0.12)',
            }}
            labelFormatter={(value) => `Round ${String(value)}`}
          />
          {/* The legend is rendered as HTML text below the chart, so Recharts'
              built-in legend is deliberately omitted - it duplicated every entry. */}
          {series.map((entry) => (
            <Line
              key={String(entry.key)}
              type="monotone"
              dataKey={String(entry.key)}
              name={entry.label}
              stroke={entry.color}
              strokeWidth={2}
              strokeDasharray={entry.dashed ? '6 4' : undefined}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      )}
    </ChartShell>
  );
}

/** Area chart, used for the accuracy / Dice trend. */
export function TrendAreaChart(props: BaseChartProps): React.JSX.Element {
  const { series, yDomain = ['auto', 'auto'] } = props;
  return (
    <ChartShell {...props}>
      {(data) => (
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="round" {...AXIS_PROPS} />
          <YAxis domain={yDomain} {...AXIS_PROPS} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #dbe3ec',
              fontSize: 13,
              boxShadow: '0 6px 18px rgba(15, 42, 66, 0.12)',
            }}
            labelFormatter={(value) => `Round ${String(value)}`}
          />
          {/* Built-in legend omitted on purpose; the HTML legend below the chart
              already lists each series exactly once. */}
          {series.map((entry) => (
            <Area
              key={String(entry.key)}
              type="monotone"
              dataKey={String(entry.key)}
              name={entry.label}
              stroke={entry.color}
              fill={entry.color}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )}
    </ChartShell>
  );
}

export interface BarPoint {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal bar chart for per-hospital comparisons. */
export function ComparisonBarChart({
  title,
  subtitle,
  points,
  ariaLabel,
  unit,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  points: BarPoint[];
  ariaLabel: string;
  unit?: string;
  height?: number;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {points.length === 0 ? (
        <EmptyState title="Nothing to compare" description="No values are available for this chart." icon="model" />
      ) : (
        <div className="chart" role="img" aria-label={ariaLabel} style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" {...AXIS_PROPS} unit={unit} />
              <YAxis type="category" dataKey="label" width={168} {...AXIS_PROPS} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #dbe3ec', fontSize: 13 }}
                formatter={(value) => [`${String(value ?? '')}${unit ?? ''}`, 'Value']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {points.map((point) => (
                  <Cell key={point.label} fill={point.color ?? '#0b3b5c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export const CHART_COLORS = {
  loss: '#b91c1c',
  validationLoss: '#f59e0b',
  dice: '#0b3b5c',
  accuracy: '#0d7d72',
} as const;
