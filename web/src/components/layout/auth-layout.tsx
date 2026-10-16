import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Icon, IconSprite } from './icon';

export interface AuthLayoutProps {
  children: ReactNode;
  /** Optional trailing link for the footer (e.g. sign-in from register). */
  footerLink?: ReactNode;
}

/**
 * Standalone auth/onboarding frame — ported from .template/login.html:
 * skip link + icon sprite, story aside (wide screens only, per CSS), brand
 * header, centered form column, compact footer. One <main> per page.
 */
export function AuthLayout({ children, footerLink }: AuthLayoutProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <IconSprite />
      <div className="auth-layout">
        <aside aria-label="StockLoop introduction" className="auth-story">
          <Link aria-label="StockLoop overview" className="brand" to="/">
            <img alt="" height={33} src="/loop.svg" width={33} />
            stockloop
          </Link>
          <img
            alt="Illustrated grocery products arranged on two shop shelves"
            className="shelf-art"
            height={280}
            src="/shelf.svg"
            width={420}
          />
          <h2>
            Your shelves.
            <br />
            One step ahead.
          </h2>
          <p>A little clarity for the next order. A little more room to run your store.</p>
          <div className="story-footer">
            Built around the neighborhood shop.
            <br />
            Human decisions. Thoughtful assistance.
          </div>
        </aside>
        <div className="auth-content">
          <header className="auth-brand">
            <Link aria-label="StockLoop overview" className="brand" to="/">
              <img alt="" height={33} src="/loop.svg" width={33} />
              stockloop
            </Link>
          </header>
          <main className="auth-form" id="main-content" tabIndex={-1}>
            {children}
          </main>
          <footer className="auth-footer">
            <span>StockLoop · Neighborhood shop operations</span>
            <span>EN / USD defaults</span>
            {footerLink}
          </footer>
        </div>
      </div>
    </>
  );
}

const AUTH_STEP_LABELS = ['1. Account', '2. Your store', '3. First import'] as const;

/** Registration progress strip from .template/register.html. Future steps are
 * plain text, not links: they are only reachable after the current step. */
export function AuthSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Registration steps" className="auth-steps">
      {AUTH_STEP_LABELS.map((label, index) => (
        <Fragment key={label}>
          {index > 0 && <Icon name="i-right" />}
          {index + 1 === current ? <strong>{label}</strong> : <span>{label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
