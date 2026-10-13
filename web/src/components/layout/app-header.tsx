import { Link, useLocation } from 'react-router-dom';

import { USE_MOCK } from '@/lib/api';
import { STORE } from '@/lib/mock/fixtures';

import { Icon } from './icon';
import { sectionLabel } from './nav';

/** App header: workspace breadcrumb + context tools (template `.app-header`). */
export function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="app-header" data-component="app-header">
      <div className="breadcrumb">
        <span>Workspace</span>
        <Icon className="sm" name="i-right" />
        <strong>{sectionLabel(pathname)}</strong>
      </div>
      <div className="header-tools">
        {/* Demo data is explicit and isolated from real operational data. */}
        {USE_MOCK && <span className="pill outline">Demo data</span>}
        <Link className="header-locale" to="/settings#region">
          EN / USD
        </Link>
        <Link aria-label="Notification settings" className="icon-btn" to="/settings">
          <Icon name="i-bell" />
        </Link>
        <Link aria-label={`${STORE.owner.name} account`} to="/settings#account">
          <span className="avatar header-avatar">{STORE.owner.initials}</span>
        </Link>
      </div>
    </header>
  );
}
