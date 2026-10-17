import { Link } from 'react-router-dom';

import { buttonClass } from '@/components/ui';

/**
 * Header/footer for the public landing page (`/`). Home for an already-home
 * visitor: the brand is text, not a self-link. Terracotta appears only on the
 * register action (the One Action Rule); sign-in stays secondary.
 */
export function LandingHeader() {
  return (
    <header className="lp-header">
      <div className="lp-shell">
        {/* Not a link: this page IS home — no self-navigation. */}
        <span className="lp-brand">
          <img alt="" height={33} src="/loop.svg" width={33} />
          stockloop
        </span>
        <nav aria-label="Account">
          <Link className={buttonClass()} to="/login">
            Sign in
          </Link>
          <Link className={buttonClass('primary')} to="/register">
            Create your store
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-shell">
        <span>StockLoop · Inventory purchasing copilot for neighborhood shops</span>
        <span>English and USD defaults — never requirements</span>
      </div>
    </footer>
  );
}
