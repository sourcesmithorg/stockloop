import { Link } from 'react-router-dom';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Icon } from '@/components/layout/icon';
import { buttonClass } from '@/components/ui';
import { usePageTitle } from '@/lib/use-page-title';

/**
 * Public landing — reached at `/` for unauthenticated visitors (the guard keeps
 * authenticated sessions out of here). Reuses the .template auth frame (same
 * Cornerstore tokens, terracotta primary, shelf/loop assets) because no
 * marketing template was delivered; every claim below is true of the built
 * product — deterministic rules, human approval, advisory AI. No invented
 * metrics, logos, testimonials, or screenshots (AGENTS.md).
 */
export function LandingPage() {
  usePageTitle('StockLoop — inventory purchasing copilot');

  return (
    <AuthLayout>
      <p className="eyebrow">Inventory purchasing copilot</p>
      <h1 className="mt-8">Know what to order, before you run out.</h1>
      <p className="intro">
        StockLoop reads your stock and sales, applies deterministic risk rules, and hands you a
        restock plan you approve. The AI suggestions are advisory — the rule code decides.
      </p>
      <div className="row wrap mt-32">
        <Link className={buttonClass('primary')} to="/register">
          <Icon name="i-right" />
          Start with your store
        </Link>
        <Link className={buttonClass()} to="/login">
          Sign in
        </Link>
      </div>

      <section aria-labelledby="landing-how" className="mt-32">
        <h2 id="landing-how">How it works</h2>
        <ol className="welcome-list">
          <li>
            <span className="step-num">1</span>
            <div className="grow">
              <h3>Deterministic rules</h3>
              <p>
                Demand window, target, and safety days — every number shows its reasoning. Empty
                data stays an honest empty state, never a guess.
              </p>
            </div>
            <span className="pill outline">Readable math</span>
          </li>
          <li>
            <span className="step-num">2</span>
            <div className="grow">
              <h3>You approve the purchase</h3>
              <p>
                A plan freezes into an immutable snapshot on your approval; purchase orders are
                built from that snapshot.
              </p>
            </div>
            <span className="pill outline">Human decision</span>
          </li>
          <li>
            <span className="step-num">3</span>
            <div className="grow">
              <h3>Advisory AI, on your terms</h3>
              <p>
                Optional AI ideas for demand, email, and alternatives — never a gate on the
                workflow, and no credential needed to run the app.
              </p>
            </div>
            <span className="pill info">Optional</span>
          </li>
        </ol>
      </section>

      <p className="data-note mt-32">
        <Icon name="i-info" />
        <span>
          Built for the neighborhood shop: English-first with EN / USD defaults, and region,
          language, currency, and timezone chosen by you at setup.
        </span>
      </p>
      <p className="small muted mt-24">
        Already have a store?{' '}
        <Link className="text-link" to="/login">
          Sign in
        </Link>{' '}
        to pick up where you left off.
      </p>
    </AuthLayout>
  );
}
