import { Link } from 'react-router-dom';

import { STORE } from '@/lib/mock/fixtures';

import { Icon } from './icon';
import { NavLinks } from './nav-links';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';

/** Desktop task sidebar — 224px, quiet, fixed (template `.sidebar`). */
export function Sidebar() {
  return (
    <aside aria-label="Main navigation" className="sidebar" data-component="app-sidebar">
      <Link aria-label="StockLoop overview" className="brand" to="/overview">
        <img alt="" height={33} src="/loop.svg" width={33} />
        stockloop
      </Link>
      <Link className="workspace-button" to="/settings#store">
        <span className="workspace-initial">{STORE.name.charAt(0)}</span>
        <span>
          <strong>{STORE.name}</strong>
          <small>{STORE.kind}</small>
        </span>
        <Icon name="i-chevron" />
      </Link>

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
        <Link className="sidebar-profile" to="/settings#account">
          <span className="avatar">{STORE.owner.initials}</span>
          <span>
            <strong>{STORE.owner.name}</strong>
            <small>{STORE.owner.role} · Demo account</small>
          </span>
        </Link>
      </div>
    </aside>
  );
}
