import { Link } from 'react-router-dom';

import { LandingFooter, LandingHeader } from '@/components/landing/chrome';
import { Icon, IconSprite } from '@/components/layout/icon';
import { buttonClass } from '@/components/ui';
import { usePageTitle } from '@/lib/use-page-title';

import '@/styles/landing.css';

/**
 * Public landing at `/` — standalone home page, not the auth frame. Reachable
 * only for unauthenticated visitors (the guard sends authenticated `/` into
 * the app). Copy is deliberately short (owner: "bit minimalist, less
 * explanation"); every claim stays checkable in this repo: deterministic rules
 * (api/app/domain/calculations.py), unknown≠zero (web/src/lib/risk-display.ts,
 * api/app/risk.py), immutable approval snapshots (api/app/plans.py,
 * api/app/routers/orders.py), advisory-only AI (api/app/services/ask.py),
 * export-is-not-send (api/app/routers/exports.py). No invented counts,
 * testimonials, scores, savings, or prices.
 */

/** Optional body: only step 4 carries one — approval binding is the claim a
 * label alone cannot hold. The other labels stand alone (owner: brevity). */
const HOW_STEPS: { body?: string; title: string }[] = [
  { title: 'Import your data' },
  { title: 'See what’s at risk' },
  { title: 'Review the restock plan' },
  {
    body: 'Approval freezes the numbers — later edits need re-approval.',
    title: 'You approve every purchase',
  },
  { title: 'Order from the approved copy' },
];

const PRINCIPLES = [
  {
    body: 'Same inputs, same answer — plain Python, no hidden model in the loop.',
    title: 'Deterministic rules decide eligibility',
  },
  {
    body: 'Missing history reads “No history”; verified zero reads “0 / day”.',
    title: 'Unknown is not zero',
  },
  {
    body: 'Totals stay per supplier and per currency — currencies are never added into one number.',
    title: 'Money keeps its currency',
  },
  {
    body: 'Every figure it quotes is checked against your real numbers — invented figures are rejected.',
    title: 'AI explains — it never decides',
  },
] as const;

const LIMITS = [
  {
    body: 'No auto-reorders, no scheduled buying. Every purchase ends with your approval.',
    title: 'Nothing buys autonomously',
  },
  {
    body: 'The model cannot approve, export, or change your data.',
    title: 'AI gets no last word',
  },
  {
    body: 'Unknown, stale, zero-sales, and measured stay four distinct states.',
    title: 'Missing data is never smoothed over',
  },
  {
    body: '“Export ready” means a file exists — StockLoop never emails suppliers.',
    title: 'Export is not email',
  },
] as const;

const SCREENS = [
  { description: 'Store snapshot and today’s priority table.', name: 'Overview' },
  { description: 'Every product with its risk state.', name: 'Inventory' },
  { description: 'Build a plan, review its reasoning.', name: 'Reorder studio' },
  {
    description: 'One document per supplier, from your approved snapshot.',
    name: 'Purchase orders',
  },
  { description: 'Your suppliers, with terms and per-currency totals.', name: 'Suppliers' },
  { description: 'Uploads validated row by row.', name: 'Data imports' },
] as const;

export function LandingPage() {
  usePageTitle('Inventory purchasing copilot');

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <IconSprite />
      <LandingHeader />

      <main className="lp-main" id="main-content" tabIndex={-1}>
        {/* ---- hero ---- */}
        <section aria-labelledby="landing-hero" className="lp-hero lp-shell">
          <div className="lp-hero-copy">
            <p className="eyebrow">Inventory purchasing copilot</p>
            <h1 id="landing-hero">Know what to order, before you run out.</h1>
            <p className="lp-lead">
              Your stock and sales become a restock plan you approve. Nothing buys on its own.
            </p>
            <div className="lp-cta-row">
              <Link className={buttonClass('primary')} to="/register">
                <Icon name="i-right" />
                Start with your store
              </Link>
              <Link className={buttonClass()} to="/login">
                Sign in
              </Link>
            </div>
          </div>
          <figure className="lp-hero-art">
            <img
              alt="Illustration of grocery products arranged on two shop shelves"
              height={280}
              loading="eager"
              src="/shelf.svg"
              width={420}
            />
            <figcaption>Built for the shop you run — not a warehouse.</figcaption>
          </figure>
        </section>

        {/* ---- the problem ---- */}
        <section aria-labelledby="landing-problem" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-problem">Ordering from memory is a gamble.</h2>
            <div className="lp-prose">
              <p>
                Supplier minimums, pack sizes, and seasonal swings make the next order hard to
                guess. StockLoop replaces the guess with a plan you can read.
              </p>
            </div>
          </div>
        </section>

        {/* ---- how it works ---- */}
        <section aria-labelledby="landing-how" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-how">From your data to an approved order.</h2>
            <ol className="welcome-list lp-steps">
              {HOW_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="step-num">{index + 1}</span>
                  <div className="grow">
                    <h3>{step.title}</h3>
                    {step.body && <p>{step.body}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- principles ---- */}
        <section aria-labelledby="landing-principles" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-principles">Numbers you can argue with.</h2>
            <ul className="lp-rows">
              {PRINCIPLES.map((principle) => (
                <li key={principle.title}>
                  <Icon name="i-check-circle" />
                  <div className="grow">
                    <h3>{principle.title}</h3>
                    <p>{principle.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- what it does not do ---- */}
        <section aria-labelledby="landing-limits" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-limits">What it deliberately does not do.</h2>
            <ul className="lp-rows">
              {LIMITS.map((limit) => (
                <li key={limit.title}>
                  <Icon name="i-shield" />
                  <div className="grow">
                    <h3>{limit.title}</h3>
                    <p>{limit.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- real screens ---- */}
        <section aria-labelledby="landing-screens" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-screens">The screens you get today.</h2>
            <p className="lp-prose">
              Not a roadmap — every screen fed by live reads of your own data.
            </p>
            <dl className="lp-screens">
              {SCREENS.map((screen) => (
                <div key={screen.name}>
                  <dt>{screen.name}</dt>
                  <dd>{screen.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---- closing ---- */}
        <section aria-labelledby="landing-cta" className="lp-closing">
          <div className="lp-shell">
            <h2 id="landing-cta">Your next order, worked out.</h2>
            <p>Set up your store, import your data, review your first plan.</p>
            <div className="lp-cta-row">
              <Link className={buttonClass('primary')} to="/register">
                <Icon name="i-right" />
                Create your store
              </Link>
              <Link className={buttonClass()} to="/login">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
