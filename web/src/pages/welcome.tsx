import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { Icon } from '@/components/layout/icon';
import { buttonClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { COUNTRIES, LANGUAGES } from '@/lib/region-data';
import { usePageTitle } from '@/lib/use-page-title';

function optionLabel(list: { value: string; label: string }[], value: string): string {
  return list.find((option) => option.value === value)?.label ?? value;
}

/** First-run welcome — .template/welcome.html, rendered inside the app shell. */
export function WelcomePage() {
  usePageTitle('Welcome');
  const { store, preferences } = useAuth();

  return (
    <>
      <PageHead
        description="Add your store data when you’re ready. No estimates until the inputs are there."
        eyebrow="First run"
        title="A fresh start for your shelves."
      />
      <div className="onboarding-wrap">
        <section className="panel panel-pad">
          <div className="empty-state">
            <img
              alt="Illustrated empty-start grocery shelf"
              className="welcome-shelf"
              height={130}
              src="/shelf.svg"
              width={170}
            />
            <h2>Let’s put your store in the loop.</h2>
            <p>
              Start with stock and sales. Add suppliers and delivery terms before making a purchase
              plan.
            </p>
          </div>
          <ol className="welcome-list">
            <li>
              <span className="step-num">1</span>
              <div className="grow">
                <h3>Inventory &amp; sales</h3>
                <p>What’s on your shelves and how it’s moving.</p>
              </div>
              <span className="pill outline">Not imported</span>
            </li>
            <li>
              <span className="step-num">2</span>
              <div className="grow">
                <h3>Suppliers &amp; terms</h3>
                <p>Prices, pack sizes, lead times, and minimum orders.</p>
              </div>
              <span className="pill outline">Not imported</span>
            </li>
            <li>
              <span className="step-num">3</span>
              <div className="grow">
                <h3>A plan you can review</h3>
                <p>Visible reasoning, clear constraints, your approval.</p>
              </div>
              <span className="pill info">Needs data</span>
            </li>
          </ol>
          <div className="row wrap mt-32">
            <Link className={buttonClass('primary')} to="/imports">
              <Icon name="i-upload" />
              Start your first import
            </Link>
            <Link className={buttonClass()} to="/overview">
              <Icon name="i-right" />
              Explore demo overview
            </Link>
          </div>
          <p className="data-note">
            <Icon name="i-info" />
            <span>
              This first run has no store data yet. The demo overview is a separate fixture.
            </span>
          </p>
        </section>
        {store && preferences && (
          <p className="small muted mt-24">
            Region: {optionLabel(COUNTRIES, store.countryCode)} ·{' '}
            {optionLabel(LANGUAGES, preferences.locale)} · {preferences.displayCurrency} ·{' '}
            {store.timezone}.{' '}
            <Link className="text-link" to="/settings#region">
              Review regional settings
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
