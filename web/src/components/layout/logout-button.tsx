import { useState } from 'react';

import { Icon } from '@/components/layout/icon';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/**
 * Discoverable sign-out in the app shell (the Settings account section is a
 * second affordance, not the only one). Same honest contract as
 * AuthProvider.logout(): local state clears only after the server confirms the
 * sign-out — on failure the user stays signed in and this says so plainly.
 */
export function LogoutButton() {
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = async () => {
    setPending(true);
    setFailed(false);
    try {
      await logout();
      // Session cleared by the provider; the route guard sends to /login.
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="mt-8">
      <Button
        aria-busy={pending || undefined}
        disabled={pending}
        size="sm"
        type="button"
        variant="ghost"
        onClick={() => void onClick()}
      >
        <Icon name="i-logout" />
        {pending ? 'Signing out…' : 'Sign out'}
      </Button>
      {failed && (
        <span className="small text-danger" role="alert">
          Sign-out did not happen — you are still signed in.
        </span>
      )}
    </span>
  );
}
