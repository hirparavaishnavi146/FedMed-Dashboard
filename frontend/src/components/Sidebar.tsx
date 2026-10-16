// Primary navigation. Collapses to an icon rail on desktop and becomes an
// off-canvas drawer below the tablet breakpoint.

import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Get Started', icon: 'play', description: 'Pick a workflow' },
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', description: 'Federation overview' },
  { to: '/training', label: 'Training', icon: 'training', description: 'Rounds and configuration' },
  { to: '/hospitals', label: 'Hospitals', icon: 'hospital', description: 'Simulated nodes' },
  { to: '/datasets', label: 'Datasets', icon: 'database', description: 'MRI data and training' },
  { to: '/case-intake', label: 'Case Intake', icon: 'search', description: 'Mixed files and case summary' },
  { to: '/medical-reports', label: 'Medical Report Analysis', icon: 'activity', description: 'Decision support' },
  { to: '/model-results', label: 'Model Results', icon: 'model', description: 'Metrics and versions' },
  { to: '/privacy-security', label: 'Privacy & Security', icon: 'privacy', description: 'Mechanisms and audit log' },
];

/**
 * Resolves the navigation entry for a path. Single source for "which page am I
 * on", used by both the header title and the browser tab title.
 * Returns undefined for addresses that are not one of the five pages.
 *
 * The index route is matched EXACTLY, and the remaining entries by prefix, so
 * "/dashboard" does not also light up "Get Started" (both would otherwise match "/").
 */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  );
}

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isMobile: boolean;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  isMobile,
}: SidebarProps): React.JSX.Element {
  const classes = [
    'sidebar',
    collapsed && !isMobile ? 'sidebar--collapsed' : '',
    isMobile && mobileOpen ? 'sidebar--open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {isMobile && mobileOpen ? (
        <div className="sidebar__scrim" onClick={onCloseMobile} aria-hidden="true" />
      ) : null}

      <aside className={classes} aria-label="Main navigation">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <Icon name="network" size={22} />
          </span>
          {!collapsed || isMobile ? (
            <span className="sidebar__brand-text">
              <span className="sidebar__brand-name">FedMed</span>
              <span className="sidebar__brand-sub">Cross-silo FL</span>
            </span>
          ) : null}
          {isMobile ? (
            <button
              type="button"
              className="icon-button sidebar__close"
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <Icon name="close" size={18} />
            </button>
          ) : null}
        </div>

        <nav className="sidebar__nav">
          <ul className="sidebar__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                  }
                  title={collapsed && !isMobile ? item.label : undefined}
                  onClick={isMobile ? onCloseMobile : undefined}
                >
                  <span className="sidebar__icon" aria-hidden="true">
                    <Icon name={item.icon} size={20} />
                  </span>
                  {!collapsed || isMobile ? (
                    <span className="sidebar__label">
                      <span>{item.label}</span>
                      <span className="sidebar__hint">{item.description}</span>
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__footer">
          {!isMobile ? (
            <button
              type="button"
              className="sidebar__collapse"
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <Icon name={collapsed ? 'expand' : 'collapse'} size={18} />
              {!collapsed ? <span>Collapse</span> : null}
            </button>
          ) : null}
          {!collapsed || isMobile ? (
            <p className="sidebar__note">
              Stage 1 frontend. Federated training and encryption are not implemented yet.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
