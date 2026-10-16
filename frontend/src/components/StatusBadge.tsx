// Small coloured status pill. The text always states the status in words, so
// colour is never the only signal (accessibility requirement).

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface StatusBadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  /** Adds a leading dot; the text still carries the meaning. */
  withDot?: boolean;
  title?: string;
}

export function StatusBadge({
  tone = 'neutral',
  children,
  withDot = true,
  title,
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {withDot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Maps a hospital status to a tone and a readable label. */
export function hospitalStatusBadge(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case 'online':
      return { tone: 'success', label: 'Online' };
    case 'degraded':
      return { tone: 'warning', label: 'Degraded' };
    case 'offline':
      return { tone: 'danger', label: 'Offline' };
    default:
      return { tone: 'neutral', label: status };
  }
}

export function datasetStatusBadge(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case 'ready':
      return { tone: 'success', label: 'Ready' };
    case 'partial':
      return { tone: 'warning', label: 'Partially prepared' };
    case 'not-prepared':
      return { tone: 'neutral', label: 'Not prepared' };
    default:
      return { tone: 'neutral', label: status };
  }
}

export function localTrainingBadge(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case 'training':
      return { tone: 'info', label: 'Training' };
    case 'complete':
      return { tone: 'success', label: 'Complete' };
    case 'failed':
      return { tone: 'danger', label: 'Failed' };
    default:
      return { tone: 'neutral', label: 'Idle' };
  }
}

export function severityBadge(severity: string): { tone: BadgeTone; label: string } {
  switch (severity) {
    case 'critical':
      return { tone: 'danger', label: 'Critical' };
    case 'warning':
      return { tone: 'warning', label: 'Warning' };
    default:
      return { tone: 'info', label: 'Info' };
  }
}
