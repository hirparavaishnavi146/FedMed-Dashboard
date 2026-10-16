// Loading, empty, error and demo-notice blocks.
// Pages use these instead of inventing their own, so every screen handles the
// same three states in the same way.

import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function LoadingState({ label = 'Loading data' }: { label?: string }): React.JSX.Element {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <p className="state__title">{label}...</p>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton__row" key={index} />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: IconName;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon = 'database',
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="state state--empty">
      <span className="state__icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="state__title">{title}</h3>
      <p className="state__description">{description}</p>
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  hint?: string;
}

export function ErrorState({ message, onRetry, hint }: ErrorStateProps): React.JSX.Element {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon state__icon--error" aria-hidden="true">
        <Icon name="warning" size={28} />
      </span>
      <h3 className="state__title">Could not load data</h3>
      <p className="state__description">{message}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
      {onRetry ? (
        <div className="state__action">
          <Button icon={<Icon name="refresh" size={16} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface NoticeProps {
  tone?: 'info' | 'warning' | 'demo';
  title: string;
  children: ReactNode;
  icon?: IconName;
}

/**
 * Inline banner. Used to state plainly what is simulated, so the interface never
 * implies that training, encryption or hospital connections are real.
 */
export function Notice({
  tone = 'info',
  title,
  children,
  icon = 'info',
}: NoticeProps): React.JSX.Element {
  return (
    <div className={`notice notice--${tone}`}>
      <span className="notice__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div className="notice__body">
        <p className="notice__title">{title}</p>
        <div className="notice__text">{children}</div>
      </div>
    </div>
  );
}
