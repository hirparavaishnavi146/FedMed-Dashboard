// Top bar: shows where you are, whether the app is in demo mode, and provides
// the mobile navigation toggle.

import { useLocation } from 'react-router-dom';
import { Button } from './Button';
import { Icon } from './Icon';
import { findNavItem } from './Sidebar';
import { StatusBadge } from './StatusBadge';
import { API_BASE_URL, IS_DEMO_MODE } from '../services/api';

export interface HeaderProps {
  onOpenMobileNav: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function Header({
  onOpenMobileNav,
  onRefresh,
  refreshing = false,
}: HeaderProps): React.JSX.Element {
  const location = useLocation();
  const current = findNavItem(location.pathname);

  return (
    <header className="header">
      <button
        type="button"
        className="icon-button header__menu"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Icon name="menu" size={20} />
      </button>

      <div className="header__titles">
        <span className="header__eyebrow">FedMed research platform</span>
        <h2 className="header__page">{current?.label ?? 'Page not found'}</h2>
      </div>

      <div className="header__actions">
        {IS_DEMO_MODE ? (
          <StatusBadge tone="warning" title={`Backend URL in configuration: ${API_BASE_URL}`}>
            Demo mode
          </StatusBadge>
        ) : (
          <StatusBadge tone="success">Live data</StatusBadge>
        )}

        <span className="header__backend" title="Backend address from VITE_API_BASE_URL">
          <Icon name="server" size={16} />
          <code>{API_BASE_URL.replace(/^https?:\/\//, '')}</code>
        </span>

        <Button
          size="sm"
          icon={<Icon name="refresh" size={16} />}
          onClick={onRefresh}
          loading={refreshing}
          aria-label="Reload the data shown on this page"
        >
          Refresh
        </Button>
      </div>
    </header>
  );
}
