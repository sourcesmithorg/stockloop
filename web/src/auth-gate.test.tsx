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

  it('routes an authenticated completed session into the app, not onboarding', () => {
    authState.status = 'authenticated';
    authState.firstRunComplete = true;
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /A little foresight/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Local to you/ })).toBeNull();
  });

  it('renders the public landing at `/` for unauthenticated visitors', () => {
    authState.status = 'unauthenticated';
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /Know what to order/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with your store/ })).toHaveAttribute(
      'href',
      '/register',
    );
    for (const link of screen.getAllByRole('link', { name: 'Sign in' })) {
      expect(link).toHaveAttribute('href', '/login');
    }
  });

  it('sends authenticated visitors at `/` into the app, not the landing', async () => {
    authState.status = 'authenticated';
    authState.firstRunComplete = true;
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: /A little foresight/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Know what to order/ })).toBeNull();
  });
});
