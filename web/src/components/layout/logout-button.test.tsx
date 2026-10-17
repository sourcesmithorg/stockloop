import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ logout: logoutMock }) }));

import { LogoutButton } from './logout-button';

afterEach(() => {
  vi.clearAllMocks();
});

describe('sign-out affordance', () => {
  it('signs out through the shared logout contract', async () => {
    logoutMock.mockResolvedValue(undefined);
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the user signed in when the server sign-out fails', async () => {
    logoutMock.mockRejectedValueOnce(new Error('server unreachable'));
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(
      await screen.findByText('Sign-out did not happen — you are still signed in.'),
    ).toBeInTheDocument();
    // Local state only clears after the server confirms — logout threw first.
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('shows a pending label while the sign-out is in flight', async () => {
    logoutMock.mockReturnValue(Promise.withResolvers<void>().promise);
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
  });
});
