import { Link } from 'react-router-dom';

import { LandingFooter, LandingHeader } from '@/components/landing/chrome';
import { Icon, IconSprite } from '@/components/layout/icon';
import { buttonClass } from '@/components/ui';
import { usePageTitle } from '@/lib/use-page-title';

import '@/styles/landing.css';

/**
 * Public landing at `/` — standalone home page, not the auth frame. Reachable
 * only for unauthenticated visitors (the guard sends authenticated `/` into
 * the app). Every claim below is checkable in this repo: deterministic rules
 * (api/app/domain/calculations.py), unknown≠zero (web/src/lib/risk-display.ts,
 * api/app/risk.py), immutable approval snapshots (api/app/plans.py,
 * api/app/routers/orders.py), advisory-only AI (api/app/services/ask.py),
 * export-is-not-send (api/app/routers/exports.py). No invented counts,
 * testimonials, scores, savings, or prices — the reference kit ships no
 * marketing screen, so this page composes only Cornerstore tokens and assets.
 */

const HOW_STEPS = [
  {
    body: 'Upload your products, sales history, and stock counts. Every row is validated before anything is trusted — bad rows come back with a reason, not a shrug.',
    title: 'Import what you already have',
  },
  {
    body: 'Each product gets a plain-language state: out of stock, at risk, running low, stale data, or healthy — with the numbers behind it one click away.',
    title: 'See what is actually at risk',
  },
  {
    body: 'Demand window, stock cover, safety stock, target days, pack rounding, and supplier minimums — computed the same way every time, with the reasoning shown.',
    title: 'Review the restock plan',
  },
  {
    body: 'Approving binds those exact numbers to an immutable version. If the inputs change later, the plan needs re-checking and re-approving — no silent edits.',
    title: 'You approve every purchase',
  },
  {
    body: 'Each supplier gets one purchase-order document built from your approved snapshot — packs, base units, currency, and provenance intact.',
    title: 'Order from the approved copy',
  },
] as const;

const PRINCIPLES = [
  {
    body: 'The purchasing math is plain Python: demand window, stock cover, safety days, pack rounding, minimum orders. Same inputs, same answer — no guessing, no hidden model in the loop.',
    title: 'Deterministic rules decide eligibility',
  },
  {
    body: 'Missing sales history reads “No history”, not zero. A verified zero reads a real “0 / day”. Missing stock reads “Unknown”. Empty data stays empty — it never pretends to be a measurement.',
    title: 'Unknown is not zero',
  },
  {
    body: 'Totals are grouped per supplier and per currency. Currencies are never added into one misleading number, and historical money is never re-labelled.',
    title: 'Money keeps its currency',
  },
  {
    body: 'The AI can explain a recommendation and propose ideas, but every figure it quotes is checked against your store’s real numbers first. A reply that invents a figure is rejected before you ever see it.',
    title: 'AI explains — it never decides',
  },
] as const;

const LIMITS = [
  {
    body: 'No scheduled buying, no auto-reorders, no “smart” checkout. Every purchase starts as a proposal and ends with your approval.',
    title: 'Nothing buys autonomously',
  },
  {
    body: 'The model cannot approve a plan, export a purchase order, or change your data. Those code paths are not reachable from the AI.',
    title: 'AI gets no last word',
  },
  {
    body: 'Unknown, stale, zero-sales, and measured data are four different states and stay four different states — everywhere in the app.',
    title: 'Missing data is never smoothed over',
  },
  {
    body: '“Export ready” means a file was produced on your request. StockLoop never emails suppliers and never claims an order was accepted or delivered.',
    title: 'Export is not email',
  },
] as const;

const SCREENS = [
  {
    description: 'Your store’s snapshot and a priority table of what needs a look today.',
    name: 'Overview',
  },
  {
    description: 'Every product with its risk state and the data behind it.',
    name: 'Inventory',
  },
  {
    description: 'Build a restock plan and review the reasoning line by line.',
    name: 'Reorder studio',
  },
  {
    description: 'Approved snapshots — one purchase-order document per supplier.',
    name: 'Purchase orders',
  },
  {
    description: 'Who you buy from, with terms and per-currency totals.',
    name: 'Suppliers',
  },
  {
    description: 'Uploads validated row by row before anything is trusted.',
    name: 'Data imports',
  },
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
              StockLoop is built for owner-operated neighborhood shops. It reads your stock and
              sales, works out what needs ordering with transparent rules, and hands you a restock
              plan to review. You approve every purchase — nothing buys on its own.
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
            <figcaption>
              Built around the shop you actually run — not a warehouse, not a spreadsheet.
            </figcaption>
          </figure>
        </section>

        {/* ---- the problem ---- */}
        <section aria-labelledby="landing-problem" className="lp-section">
          <div className="lp-shell">
            <h2 id="landing-problem">Ordering from memory is a gamble.</h2>
            <div className="lp-prose">
              <p>
                Between supplier minimums, pack sizes, seasonal swings, and a shelf full of little
                SKUs, the next order is rarely obvious. Order too little and the shelf is empty.
                Order too much and your cash sits in the stockroom.
              </p>
              <p>
                Spreadsheets help until they don’t — the numbers go stale, and nobody trusts the
                sheet at the moment it matters. StockLoop replaces the guesswork with a plan you can
                read, question, and approve.
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
                    <p>{step.body}</p>
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
            <p className="lp-prose">
              A purchasing tool is only worth its arithmetic. These four rules are built into the
              code, not painted on top of it.
            </p>
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
            <p className="lp-prose">
              The short list of things we refuse to fake is the strongest promise this page makes.
            </p>
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
              Not a roadmap — the working product, each screen fed by live reads from your own data.
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
            <h2 id="landing-cta">Your next order, worked out before you sit down to it.</h2>
            <p>Set up your store, import your data, and review your first restock plan.</p>
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
