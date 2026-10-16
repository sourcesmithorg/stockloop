import { describe, expect, it } from 'vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';
import App from '@/App';

// Mirrors main.tsx's production mount: MemoryRouter (test) + AuthProvider + App.
function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function seedRegistration(email: string, storeName = 'Fresh Store') {
  // Real provider path: the module-scoped mock session is what AuthProvider's
  // initial refresh() reads, exactly like the cookie session in production.
  await mockApi.register({
    country: 'US',
    currency: 'USD',
    email,
    language: 'en',
    password: 'correct-horse-battery',
    storeName,
    timezone: 'UTC',
  });
}

describe('first-run completion (lockout regression)', () => {
  it('register starts incomplete: /overview bounces to /onboarding', async () => {
    await seedRegistration('fr-one@example.test');
    renderApp('/overview');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Local to you/ }),
    ).toBeInTheDocument();
  });

  it('onboarding asks only name + region + interface and submits derived currency/timezone', async () => {
    const user = userEvent.setup();
    await seedRegistration('fr-two@example.test');

    // Session must start incomplete: /overview is bounced to onboarding.
    renderApp('/overview');
    await screen.findByRole('heading', { level: 1, name: /Local to you/ });
    expect((await mockApi.me()).firstRunComplete).toBe(false);

    // Reduced field set: exactly three inputs; currency, timezone and catalog size are gone.
    expect(screen.getByLabelText(/Store name/)).toBeInTheDocument();
    expect(screen.getByLabelText('Store country')).toBeInTheDocument();
    expect(screen.getByLabelText('Interface language')).toBeInTheDocument();
    expect(screen.queryByLabelText('Store currency')).toBeNull();
    expect(screen.queryByLabelText('Store timezone')).toBeNull();
    expect(screen.queryByLabelText('Catalog size')).toBeNull();

    // The derived values are visible before submit (JP → JPY / Asia/Tokyo).
    await user.selectOptions(screen.getByLabelText('Store country'), 'JP');
    const suggestion = screen.getByText(/Following your region/);
    expect(suggestion).toHaveTextContent('JPY');
    expect(suggestion).toHaveTextContent('Asia/Tokyo');

    // Complete setup through the real form (explicit completeFirstRun flag).
    await user.click(screen.getByRole('button', { name: /Complete setup/ }));

    // The guard now admits the session; /welcome renders inside the app shell.
    expect(
      await screen.findByRole('heading', { level: 1, name: /A fresh start/ }),
    ).toBeInTheDocument();
    const me = await mockApi.me();
    expect(me.firstRunComplete).toBe(true);
    // The derived values were actually submitted, not just shown — and language
    // stayed the user's own choice (never derived from the country).
    expect(me.store.name).toBe('Fresh Store');
    expect(me.store.countryCode).toBe('JP');
    expect(me.store.defaultCurrency).toBe('JPY');
    expect(me.store.timezone).toBe('Asia/Tokyo');
    expect(me.preferences.locale).toBe('en');

    // The lockout case: this store has no products and no imports, yet the app admits it.
    renderApp('/overview');
    expect(
      await screen.findByRole('heading', { level: 1, name: /A little foresight/ }),
    ).toBeInTheDocument();
    expect((await mockApi.me()).store.firstRunComplete).toBe(true);
  });

  it('overview describes the real store, never a hardcoded fixture name (F4)', async () => {
    await seedRegistration('fr-three@example.test', 'Evidence Test Store');
    await mockApi.updateStore({ completeFirstRun: true, expectedVersion: 1 });
    renderApp('/overview');
    await screen.findByRole('heading', { level: 1, name: /A little foresight/ });
    expect(screen.getByText(/deserves a look at Evidence Test Store today/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Maple & Main');
  });

  it('sidebar profile link has a coherent accessible name, not a concatenation (F5)', async () => {
    await seedRegistration('fr-four@example.test');
    await mockApi.updateStore({ completeFirstRun: true, expectedVersion: 1 });
    renderApp('/overview');
    await screen.findByRole('heading', { level: 1, name: /A little foresight/ });
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' });
    const profile = within(sidebar).getByRole('link', { name: 'fr-four@example.test account' });
    expect(profile).toHaveAttribute('href', '/settings#account');
    // The pre-fix accessible name was avatar+email+role glued together.
    expect(screen.queryByRole('link', { name: /@example\.testowner/ })).toBeNull();
  });
});
