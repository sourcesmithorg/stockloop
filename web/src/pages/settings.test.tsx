import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';
import { SettingsPage } from '@/pages/settings';
function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function seedRegistration(email: string) {
  return mockApi.register({
    country: 'US',
    currency: 'USD',
    email,
    language: 'en',
    password: 'correct-horse-battery',
    storeName: 'Maple & Main',
    timezone: 'UTC',
  });
}

describe('settings regional save flow (T-05)', () => {
  it('tracks dirty → saving → success and keeps currency independent of country', async () => {
    const user = userEvent.setup();
    await seedRegistration('owner-save@example.test');
    renderSettings();

    const country = (await screen.findByLabelText('Store country')) as HTMLSelectElement;
    const currency = screen.getByLabelText('Display currency') as HTMLSelectElement;
    const timezone = screen.getByLabelText('Store timezone') as HTMLSelectElement;
    const status = screen.getByRole('status');
    const save = screen.getByRole('button', { name: /Save changes/ });

    expect(status).toHaveTextContent(/No unsaved changes/);
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');

    await user.selectOptions(country, 'CA');
    expect(status).toHaveTextContent(/Unsaved changes/);
    // T-05: changing country does not change the display currency or the timezone.
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');

    await user.click(save);
    await waitFor(() => expect(status).toHaveTextContent(/Changes saved/));
    expect(country).toHaveValue('CA');
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');
  }, 20_000);

  it('surfaces a version conflict with the current version and retries after re-fetch', async () => {
    const user = userEvent.setup();
    await seedRegistration('owner-conflict@example.test');
    renderSettings();

    const country = (await screen.findByLabelText('Store country')) as HTMLSelectElement;
    const status = screen.getByRole('status');

    // Simulate a concurrent external edit so the store version is now stale.
    const { store } = await mockApi.getStore();
    await mockApi.updateStore({
      country: 'US',
      expectedVersion: store.version,
      name: 'Elsewhere',
      timezone: 'UTC',
    });

    await user.selectOptions(country, 'GB');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    const currentVersion = (await mockApi.getStore()).store.version;
    await waitFor(() => expect(status).toHaveTextContent(new RegExp(`version ${currentVersion}`)));
    expect(status).toHaveTextContent(/Version conflict/);
    // The user's input is retained for retry.
    expect(country).toHaveValue('GB');

    await user.click(screen.getByRole('button', { name: /Retry save/ }));
    await waitFor(() => expect(status).toHaveTextContent(/Changes saved/));
    expect(country).toHaveValue('GB');
  }, 20_000);
});

function renderSettingsRoutes() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <Routes>
          <Route element={<h1>Standalone</h1>} path="/" />
          <Route element={<SettingsPage />} path="/settings" />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('settings account section and sign-out', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the #account section the header and sidebar link to', async () => {
    await seedRegistration('owner-account@example.test');
    renderSettings();
    const heading = await screen.findByRole('heading', { level: 2, name: 'Your account' });
    const section = heading.closest('section');
    // The app links avatar/profile to /settings#account — the anchor must exist.
    expect(section?.id).toBe('account');
    expect(section).toHaveTextContent('owner-account@example.test');
    expect(section).toHaveTextContent('Store owner');
    expect(within(section as HTMLElement).getByRole('button', { name: /Sign out/ })).toBeEnabled();
  }, 20_000);

  it('signing out clears the session and lands on the public page', async () => {
    await seedRegistration('owner-signout@example.test');
    renderSettingsRoutes();
    const button = await screen.findByRole('button', { name: /Sign out/ });
    await userEvent.setup().click(button);
    // Cleared session: navigation to the public page happened, and only then
    // is the mock session verifiably gone.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standalone' }),
    ).toBeInTheDocument();
    await expect(mockApi.me()).rejects.toThrow();
  }, 20_000);

  it('a failed sign-out is surfaced and does not pretend to have signed out', async () => {
    await seedRegistration('owner-signout-fail@example.test');
    vi.spyOn(api, 'logout').mockRejectedValue(new ApiError(502, '502 Bad Gateway on /auth/logout'));
    renderSettingsRoutes();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sign out/ }));
    const status = await screen.findByText(/502 Bad Gateway on \/auth\/logout/);
    expect(status).toBeInTheDocument();
    // Session kept: still on settings, still signed in (scoped to #account —
    // the members table lists the same email).
    const heading = screen.getByRole('heading', { level: 2, name: 'Your account' });
    expect(heading).toBeInTheDocument();
    const section = heading.closest('section');
    expect(
      within(section as HTMLElement).getByText('owner-signout-fail@example.test'),
    ).toBeInTheDocument();
  }, 20_000);
});
