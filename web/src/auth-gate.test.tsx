import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Controlled from tests via module-scoped mutable references.
const authState = vi.hoisted(() => ({
  firstRunComplete: true,
  status: 'unauthenticated',
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    firstRunComplete: authState.firstRunComplete,
    preferences: null,
    status: authState.status,
    store: null,
    user: null,
  }),
}));

import App from '@/App';

describe('auth gate', () => {
  it('sends unauthenticated visitors to /login with a next target', async () => {
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your store, in the loop.' }),
    ).toBeInTheDocument();
  });

  it('routes an authenticated first-run session to /onboarding', async () => {
    authState.status = 'authenticated';
    authState.firstRunComplete = false;
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: /Local to you/ }),
    ).toBeInTheDocument();
  });
});
