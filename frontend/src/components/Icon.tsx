// Outline icon set. Deliberately stroked (no filled tiles, no emoji) so the
// dashboard matches clinical/technical software conventions.
// Every icon is a single SVG path drawn on a 24x24 grid with a 2px stroke.

import type { SVGProps } from 'react';

export type IconName =
  | 'dashboard'
  | 'training'
  | 'hospital'
  | 'model'
  | 'privacy'
  | 'menu'
  | 'collapse'
  | 'expand'
  | 'search'
  | 'close'
  | 'info'
  | 'warning'
  | 'check'
  | 'database'
  | 'lock'
  | 'refresh'
  | 'play'
  | 'stop'
  | 'clock'
  | 'server'
  | 'activity'
  | 'network'
  | 'shield'
  | 'arrowLeft';

const PATHS: Record<IconName, string> = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6V11h-6v9Zm0-16v4h6V4h-6Z',
  training: 'M3 17l5-6 4 3 5-7 4 4M3 21h18M3 3v18',
  hospital: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M12 8v4M10 10h4',
  model: 'M4 19V5m0 14h16M8 15V9m4 6V6m4 9v-4',
  privacy: 'M12 3l7 3v5c0 4.5-3 7.9-7 10-4-2.1-7-5.5-7-10V6l7-3Zm0 6v4m0 3h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  collapse: 'M15 6l-6 6 6 6',
  expand: 'M9 6l6 6-6 6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13h.01M11 12h1v5h1',
  warning: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
  check: 'M20 6 9 17l-5-5',
  database: 'M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8Zm8-2.5v13c0 1.4-3.6 2.5-8 2.5s-8-1.1-8-2.5v-13M20 12c0 1.4-3.6 2.5-8 2.5S4 13.4 4 12',
  lock: 'M6 11h12v10H6V11Zm3 0V7a3 3 0 0 1 6 0v4M12 15v2',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  play: 'M7 4l12 8-12 8V4Z',
  stop: 'M7 7h10v10H7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2',
  server: 'M4 5h16v6H4V5Zm0 8h16v6H4v-6Zm3-5h.01M7 16h.01',
  activity: 'M3 12h4l2.5-6 4 12 2.5-6H21',
  network: 'M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-6 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm12 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM12 9v3m0 0-4.5 3M12 12l4.5 3',
  shield: 'M12 3 5 6.5v4.9c0 4 2.9 7.2 7 9.1 4.1-1.9 7-5.1 7-9.1V6.5L12 3Zm-2.2 8.8 1.7 1.7 3.4-3.4',
  arrowLeft: 'M19 12H5m6-7-7 7 7 7',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Decorative by default. Pass a label to expose it to screen readers. */
  label?: string;
}

export function Icon({ name, size = 20, label, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
