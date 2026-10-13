import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from './icon';
import { NavLinks } from './nav-links';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';

/**
 * Narrow-layout navigation: a native `<details>` disclosure (keyboard and touch
 * for free). Closing only happens when a link is activated — focus must never
 * be stranded inside a menu that navigation removed.
 */
export function MobileNav() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeOnLink = (event: MouseEvent<HTMLDetailsElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor && detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-nav-landmark"
      data-component="mobile-navigation"
    >
      <details className="mobile-nav" onClick={closeOnLink} ref={detailsRef}>
        <summary>
          <span className="brand">
            <img alt="" height={33} src="/loop.svg" width={33} />
            stockloop
          </span>
          <span className="row small">
            Menu
            <Icon name="i-menu" />
          </span>
        </summary>
        <NavLinks items={PRIMARY_NAV} />
        {SECONDARY_NAV.map((item) => (
          <Link className="nav-link" key={item.to} to={item.to}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </details>
    </nav>
  );
}
