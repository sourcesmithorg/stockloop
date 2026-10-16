import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Icon } from '@/components/layout/icon';
import { Button, Field, InlineNote, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/lib/use-page-title';

/** Sign-in — .template/login.html. On success the route guard in App.tsx
 * sends the session to ?next= (default /overview), or to /onboarding for a
 * brand-new account. */
export function LoginPage() {
  usePageTitle('Sign in');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      // Guard reacts to the authenticated status; nothing else to do here.
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? { message: caught.message, field: caught.field }
          : { message: 'Could not reach StockLoop. Check your connection and retry.' },
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-8">Your store, in the loop.</h1>
      <p className="intro">Pick up where you left off.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <Field error={error?.field === 'email' ? error.message : undefined} label="Email address">
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@yourstore.com"
            required
            type="email"
            value={email}
          />
        </Field>
        <Field error={error?.field === 'password' ? error.message : undefined} label="Password">
          <Input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={password}
          />
        </Field>
        {/* ponytail: remember-device has no API field yet; kept for template fidelity. */}
        <div className="row between wrap">
          <label className="checkbox-line" htmlFor="remember-session">
            <input id="remember-session" name="remember-session" type="checkbox" />
            <span>Remember this device</span>
          </label>
        </div>
        {error && !error.field && (
          <div role="alert">
            <InlineNote tone="bad" title="Could not sign in">
              {error.message}
            </InlineNote>
          </div>
        )}
        <Button
          className="w-full"
          loading={submitting}
          loadingLabel="Signing in…"
          type="submit"
          variant="primary"
        >
          <Icon name="i-right" />
          Open dashboard
        </Button>
      </form>
      <p className="data-note">
        <Icon name="i-info" />
        <span>Sessions use a server-set cookie on this device. Sign-in opens your own store.</span>
      </p>
      <p className="small muted mt-24">
        New to StockLoop?{' '}
        <Link className="text-link" to="/register">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
