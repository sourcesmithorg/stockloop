import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { AuthLayout, AuthSteps } from '@/components/layout/auth-layout';
import { Icon } from '@/components/layout/icon';
import { Button, Field, InlineNote, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_TIMEZONE,
} from '@/lib/region-data';
import { usePageTitle } from '@/lib/use-page-title';

const KNOWN_FIELDS = ['email', 'password', 'storeName'] as const;
type KnownField = (typeof KNOWN_FIELDS)[number];

/** Registration — .template/register.html. The API creates the account with
 * the English/USD defaults; the guarded /onboarding step then picks the real
 * region (the template's "2. Your store"). */
export function RegisterPage() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; field?: KnownField } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({
        email,
        password,
        storeName,
        country: DEFAULT_COUNTRY,
        language: DEFAULT_LANGUAGE,
        currency: DEFAULT_CURRENCY,
        timezone: DEFAULT_TIMEZONE,
      });
      // The guard routes the fresh (not-yet-first-run-complete) session to
      // /onboarding.
    } catch (caught) {
      const field = caught instanceof ApiError ? caught.field : undefined;
      setError(
        caught instanceof ApiError
          ? {
              message: caught.message,
              field:
                field && (KNOWN_FIELDS as readonly string[]).includes(field)
                  ? (field as KnownField)
                  : undefined,
            }
          : { message: 'Could not create the account. Check your connection and retry.' },
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthSteps current={1} />
      <h1>
        A better rhythm
        <br />
        for your store.
      </h1>
      <p className="intro">Account details. Required fields are marked *.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <Field
          error={error?.field === 'storeName' ? error.message : undefined}
          label="Store name"
          required
        >
          <Input
            autoComplete="organization"
            onChange={(event) => setStoreName(event.target.value)}
            placeholder="Maple & Main"
            required
            type="text"
            value={storeName}
          />
        </Field>
        <Field
          error={error?.field === 'email' ? error.message : undefined}
          label="Email address"
          required
        >
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@yourstore.com"
            required
            type="email"
            value={email}
          />
        </Field>
        <Field
          error={error?.field === 'password' ? error.message : undefined}
          help="Use 12 or more characters, unique to this account."
          label="Create password"
          required
        >
          <Input
            autoComplete="new-password"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Use a unique password"
            required
            type="password"
            value={password}
          />
        </Field>
        <label className="checkbox-line" htmlFor="terms-ack">
          <input id="terms-ack" name="terms-ack" required type="checkbox" />
          <span>
            I’ll confirm my store’s region in the next step.
            <small>
              Country, language, currency, and timezone are chosen on the store-setup screen.
            </small>
          </span>
        </label>
        {error && !error.field && (
          <div role="alert">
            <InlineNote tone="bad" title="Could not create the account">
              {error.message}
            </InlineNote>
          </div>
        )}
        <Button
          className="w-full"
          loading={submitting}
          loadingLabel="Creating account…"
          type="submit"
          variant="primary"
        >
          <Icon name="i-right" />
          Continue to store setup
        </Button>
      </form>
      <p className="data-note">
        <Icon name="i-info" />
        <span>
          Your account and store are created together, starting with English and USD defaults.
          Region stays editable in the next step.
        </span>
      </p>
      <p className="small muted mt-24">
        Already have an account?{' '}
        <Link className="text-link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
