// Tab strip with full keyboard support.
// Left/Right arrows move between tabs, Home/End jump to the ends, and each tab
// is linked to its panel with aria-controls.

import { useRef, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Optional count shown after the label, e.g. "Hospitals (3)". */
  count?: number;
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  /** Used to build the ids that link tabs to panels. */
  idPrefix: string;
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  idPrefix,
}: TabsProps<T>): React.JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (delta: number): void => {
    const index = items.findIndex((item) => item.id === active);
    const next = (index + delta + items.length) % items.length;
    const target = items[next];
    if (target) {
      onChange(target.id);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label="Sections">
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tabs__tab${selected ? ' tabs__tab--active' : ''}`}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                move(-items.findIndex((entry) => entry.id === active));
              } else if (event.key === 'End') {
                event.preventDefault();
                move(items.length - 1 - items.findIndex((entry) => entry.id === active));
              }
            }}
          >
            {item.label}
            {item.count !== undefined ? <span className="tabs__count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  id,
  children,
}: {
  idPrefix: string;
  id: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className="tabs__panel"
    >
      {children}
    </div>
  );
}
