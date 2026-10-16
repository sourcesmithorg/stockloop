import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { USE_MOCK } from '@/lib/api';

import { AppHeader } from './app-header';
import { IconSprite } from './icon';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';

/**
 * App shell — ported from .template/index.html. Invariants:
 * skip link is the first focusable element; one <main> per page; route changes
 * move focus to the new h1 instead of stranding it in a removed menu.
 */
export function AppShell() {
  const { pathname } = useLocation();
  // Track the last focused pathname instead of a "first run" flag: React
  // StrictMode re-runs effects on mount, and initial load must leave focus at
  // the top so the skip link stays the first stop.
  const lastFocusedPath = useRef(pathname);

  useEffect(() => {
    if (lastFocusedPath.current === pathname) return;
    lastFocusedPath.current = pathname;
    document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <IconSprite />
      <Sidebar />
      <MobileNav />
      <div className="app-main">
        <AppHeader />
        <main className="main" id="main-content" tabIndex={-1}>
          <Outlet />
          <footer className="page-footer">
            <span>
              {USE_MOCK
                ? 'StockLoop demo · fixture data only — nothing here is a real order.'
                : 'Live store data from this store — nothing is ordered without your approval.'}
            </span>
            <span>Deterministic rules · human review</span>
          </footer>
        </main>
      </div>
    </>
  );
}
