import { NavLink } from 'react-router-dom';

import { Icon } from './icon';
import type { NavItem } from './nav';

/**
 * Primary/secondary section links. NavLink sets `aria-current="page"` on the
 * active route; the Cornerstore `.nav-link[aria-current=page]` styles follow.
 */
export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="nav-list">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink className="nav-link" end={item.end} to={item.to} onClick={onNavigate}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
