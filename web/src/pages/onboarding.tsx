import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthLayout, AuthSteps } from '@/components/layout/auth-layout';
import { Icon } from '@/components/layout/icon';
import { Button, Field, InlineNote, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  type RegionOption,
} from '@/lib/region-data';
import { countryDefaults } from '@/lib/region-defaults';
import { usePageTitle } from '@/lib/use-page-title';

function options(list: RegionOption[]) {
  return list.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}

// Fields this form actually renders; anything else surfaces in the alert below.
const RENDERED_FIELDS = ['name', 'storeName', 'country', 'language'] as const;

/** Store setup — the owner's reduced flow (store name + region + interface
 * language only). Currency and timezone are not asked: they follow the selected
 * region as visible first-run suggestions and stay editable in /settings.
 * Catalog size was also dropped (it never had an API field). Both are deliberate
 * divergences from .template/onboarding.html — the owner asked for a less
 * overwhelming onboarding. */
export function OnboardingPage() {
  usePageTitle('Set up your store');
  const navigate = useNavigate();
  const { store, preferences, updateStore, updatePreferences, refresh } = useAuth();

  const [name, setName] = useState(store?.name ?? '');
  const [country, setCountry] = useState(store?.countryCode ?? DEFAULT_COUNTRY);
  const [language, setLanguage] = useState(preferences?.locale ?? DEFAULT_LANGUAGE);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // First-run values only: derived from the selected region, shown below, and
  // submitted explicitly — never silently. Settings keeps full control later;
  // changing country in /settings must NOT re-derive these (T-05).
  const derived = countryDefaults(country);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateStore({
        name,
        country,
        defaultCurrency: derived.currency,
        timezone: derived.timezone,
        // Explicit, one-way completion flag — never inferred from region saves.
        completeFirstRun: true,
      });
      if (language !== preferences?.locale) {
        await updatePreferences({ locale: language });
      }
      await refresh();
      navigate('/welcome', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? { message: caught.message, field: caught.field }
          : { message: 'Could not save your store setup. Check your connection and retry.' },
      );
      setSubmitting(false);
    }
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <AuthLayout>
      <AuthSteps current={2} />
      <h1>
        Local to you.
        <br />
        Ready for anywhere.
      </h1>
      <p className="intro">
        Your store's name, region, and language. Currency and timezone follow the region — you can
        change them any time in Settings.
      </p>
      <form className="stack" onSubmit={handleSubmit}>
        <Field error={fieldError('name') ?? fieldError('storeName')} label="Store name" required>
          <Input
            autoComplete="organization"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </Field>
        <div className="field-grid two">
          <Field
            error={fieldError('country')}
            help="ISO country choices. Currency and timezone follow this region."
            label="Store country"
          >
            <Select onChange={(event) => setCountry(event.target.value)} value={country}>
              {options(COUNTRIES)}
            </Select>
          </Field>
          <Field
            error={fieldError('language')}
            help="The screens remain English until translations exist."
            label="Interface language"
          >
            <Select onChange={(event) => setLanguage(event.target.value)} value={language}>
              {options(LANGUAGES)}
            </Select>
          </Field>
        </div>
        <p className="data-note">
          <Icon name="i-info" />
          <span>
            Following your region: currency <strong>{derived.currency}</strong> and timezone{' '}
            <strong>{derived.timezone}</strong>. These are starting values — review and change them
            any time in <strong>Settings → Region</strong>.
          </span>
        </p>
        {error &&
          !(error.field && (RENDERED_FIELDS as readonly string[]).includes(error.field)) && (
            <div role="alert">
              <InlineNote tone="bad" title="Could not save your store setup">
                {error.message}
              </InlineNote>
            </div>
          )}
        <Button
          className="w-full"
          loading={submitting}
          loadingLabel="Saving…"
          type="submit"
          variant="primary"
        >
          <Icon name="i-right" />
          Complete setup
        </Button>
      </form>
      <p className="data-note">
        <Icon name="i-info" />
        <span>
          Country and language are saved exactly as you choose. Currency and timezone start from
          your region's defaults — editable any time in Settings. Nothing is translated or
          converted.
        </span>
      </p>
    </AuthLayout>
  );
}
