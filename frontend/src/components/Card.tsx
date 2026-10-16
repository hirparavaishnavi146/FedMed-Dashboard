// Layout primitives: Card, SectionHeading, PageHeader, StatList, ProgressBar.
// Grouped in one file because they are small, always used together, and share
// the same styling vocabulary.

import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds a subtle emphasis border, used for the "as at" summary cards. */
  accent?: boolean;
}

export function Card({ children, className, accent = false }: CardProps): React.JSX.Element {
  return (
    <section className={['card', accent ? 'card--accent' : '', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand side content: buttons, badges, filters. */
  action?: ReactNode;
  id?: string;
}

export function CardHeader({ title, subtitle, action, id }: CardHeaderProps): React.JSX.Element {
  return (
    <header className="card__header">
      <div className="card__titles">
        <h2 className="card__title" id={id}>
          {title}
        </h2>
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="card__action">{action}</div> : null}
    </header>
  );
}

export interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps): React.JSX.Element {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  );
}

export interface StatListProps {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
}

export function StatList({ items, columns = 2 }: StatListProps): React.JSX.Element {
  return (
    <dl className={`stat-list stat-list--${columns}`}>
      {items.map((item) => (
        <div className="stat-list__row" key={item.label}>
          <dt className="stat-list__label">{item.label}</dt>
          <dd className="stat-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ProgressBarProps {
  /** 0 to 100. */
  value: number;
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  /** Shows the numeric value next to the label. */
  showValue?: boolean;
}

export function ProgressBar({
  value,
  label,
  tone = 'primary',
  showValue = true,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress">
      <div className="progress__meta">
        <span className="progress__label">{label}</span>
        {showValue ? <span className="progress__value">{clamped}%</span> : null}
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
