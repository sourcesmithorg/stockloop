import { Link, useLocation } from 'react-router-dom';

import { USE_MOCK } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STORE } from '@/lib/mock/fixtures';

import { Icon } from './icon';
import { sectionLabel } from './nav';

/** App header: workspace breadcrumb + context tools (template `.app-header`). */
export function AppHeader() {
  const { pathname } = useLocation();
  const { user, store, preferences } = useAuth();

  // Real session state when authenticated; fixtures only in USE_MOCK demo builds.
  const accountName = user?.email ?? (USE_MOCK ? STORE.owner.name : null);
  const accountInitials = user
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : USE_MOCK
      ? STORE.owner.initials
      : null;
  const locale = preferences?.locale ?? store?.locale ?? (USE_MOCK ? STORE.locale : null);
  const currency =
    preferences?.displayCurrency ?? store?.defaultCurrency ?? (USE_MOCK ? STORE.currency : null);

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
        {locale && currency && (
          <Link className="header-locale" to="/settings#region">
            {locale.toUpperCase()} / {currency}
          </Link>
        )}
        <Link aria-label="Notification settings" className="icon-btn" to="/settings">
          <Icon name="i-bell" />
        </Link>
        {accountName && accountInitials && (
          <Link aria-label={`${accountName} account`} to="/settings#account">
            <span className="avatar header-avatar">{accountInitials}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
