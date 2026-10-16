import { Link } from 'react-router-dom';

import { USE_MOCK } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STORE } from '@/lib/mock/fixtures';

import { Icon } from './icon';
import { NavLinks } from './nav-links';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';

/** Desktop task sidebar — 224px, quiet, fixed (template `.sidebar`). */
export function Sidebar() {
  const { user, store } = useAuth();

  // Real session state when authenticated; fixtures only in USE_MOCK demo builds.
  const workspaceName = store?.name ?? (USE_MOCK ? STORE.name : null);
  const workspaceKind = USE_MOCK ? STORE.kind : null;
  const profileName = user?.email ?? (USE_MOCK ? STORE.owner.name : null);
  const profileInitials = user
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : USE_MOCK
      ? STORE.owner.initials
      : null;
  const profileRole = user?.role ?? (USE_MOCK ? STORE.owner.role : null);

  return (
    <aside aria-label="Main navigation" className="sidebar" data-component="app-sidebar">
      <Link aria-label="StockLoop overview" className="brand" to="/overview">
        <img alt="" height={33} src="/loop.svg" width={33} />
        stockloop
      </Link>
      {workspaceName && (
        <Link className="workspace-button" to="/settings#store">
          <span className="workspace-initial">{workspaceName.charAt(0)}</span>
          <span>
            <strong>{workspaceName}</strong>
            {workspaceKind && <small>{workspaceKind}</small>}
          </span>
          <Icon name="i-chevron" />
        </Link>
      )}

      <NavLinks items={PRIMARY_NAV} />

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <strong>Good stock. Less guesswork.</strong>
          Your shelf, one step ahead.
        </div>
        {SECONDARY_NAV.map((item) => (
          <Link className="nav-link" key={item.to} to={item.to}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        {profileName && profileInitials && (
          <Link
            aria-label={`${profileName} account`}
            className="sidebar-profile"
            to="/settings#account"
          >
            <span className="avatar">{profileInitials}</span>
            <span>
              <strong>{profileName}</strong>
              <small>
                {profileRole}
                {profileRole && USE_MOCK ? ' · Demo account' : ''}
              </small>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
