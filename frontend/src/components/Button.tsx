// One button component for the whole app: consistent variants, sizes, loading
// state and, importantly, an honest "disabled with a reason" mode.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  /**
   * Why the button cannot be used yet. When set, the button is disabled and the
   * reason is shown in the tooltip, so a greyed-out control is never a mystery.
   */
  disabledReason?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabledReason,
  icon,
  fullWidth = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled === true || loading || Boolean(disabledReason);
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      title={disabledReason ?? rest.title}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}
