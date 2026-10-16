// Form controls: text, number, select, slider and switch.
// Each control renders a real <label>, keeps its own error text tied to the
// input with aria-describedby, and reports invalid state with aria-invalid.

import type { ChangeEvent, ReactNode } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  /** Regular control on the left, switch or unit on the right. */
  inline?: boolean;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  inline = false,
}: FieldShellProps): React.JSX.Element {
  return (
    <div className={`field${inline ? ' field--inline' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span className="field__required"> (required)</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  type?: 'text' | 'search';
  required?: boolean;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  type = 'text',
  required,
}: TextFieldProps): React.JSX.Element {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        className={`input${error ? ' input--invalid' : ''}`}
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null]
          .filter(Boolean)
          .join(' ') || undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  error?: string;
  unit?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  error,
  unit,
}: NumberFieldProps): React.JSX.Element {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="input-group">
        <input
          className={`input${error ? ' input--invalid' : ''}`}
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.valueAsNumber)}
        />
        {unit ? <span className="input-group__suffix">{unit}</span> : null}
      </div>
    </FieldShell>
  );
}

export interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>): React.JSX.Element {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select
        className="input select"
        id={id}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  format?: (value: number) => string;
}

export function RangeField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  format,
}: RangeFieldProps): React.JSX.Element {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <div className="range">
        <input
          className="range__input"
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.valueAsNumber)}
        />
        <output className="range__value" htmlFor={id}>
          {format ? format(value) : value}
        </output>
      </div>
    </FieldShell>
  );
}

export interface SwitchFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function SwitchField({
  id,
  label,
  checked,
  onChange,
  hint,
  disabled,
  disabledReason,
}: SwitchFieldProps): React.JSX.Element {
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {hint ? (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        ) : null}
        {disabled && disabledReason ? (
          <p className="field__note" id={`${id}-reason`}>
            {disabledReason}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={
          [hint ? `${id}-hint` : null, disabled && disabledReason ? `${id}-reason` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={`switch${checked ? ' switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__knob" aria-hidden="true" />
      </button>
    </div>
  );
}
