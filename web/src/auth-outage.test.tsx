import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError, type MeOut } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import App from '@/App';

const ME: MeOut = {
  firstRunComplete: false,
  preferences: {
    dateFormat: null,
    displayCurrency: null,
    locale: null,
    numberFormat: null,
    timezone: null,
    version: 1,
  },
  store: {
    countryCode: 'US',
    defaultCurrency: 'USD',
    firstRunComplete: false,
    id: 'store-1',
    locale: 'en',
    name: 'Maple & Main',
    timezone: 'UTC',
    version: 1,
  },
  user: { email: 'owner@example.test', id: 'user-1', role: 'owner' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('session read failure is told honestly (M7 outage vs logout)', () => {
  it('a 401 on me() is a real sign-out: routes to login', async () => {
    vi.spyOn(api, 'me').mockRejectedValue(new ApiError(401, 'Authentication required'));
    renderApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your store, in the loop.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cannot reach StockLoop/)).toBeNull();
  });

  it('a 5xx on me() is an outage, not a logout: honest failure, no redirect, retry recovers', async () => {
    const me = vi
      .spyOn(api, 'me')
      .mockRejectedValue(new ApiError(502, '502 Bad Gateway on /auth/me'));
    renderApp();

    // Honest failure state — never the login page, never a silent flip.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach StockLoop right now');
    expect(alert).toHaveTextContent('Your session was not signed out.');
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Your store, in the loop.' }),
    ).toBeNull();

    // The session is unknown, not revoked: a successful retry resumes into the app.
    me.mockResolvedValue(ME);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Local to you/ }),
    ).toBeInTheDocument();
  }, 20_000);

  it('a network failure (non-ApiError) on me() also shows the outage state', async () => {
    vi.spyOn(api, 'me').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp();
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent('Cannot reach StockLoop right now');
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Your store, in the loop.' }),
    ).toBeNull();
  });
});
