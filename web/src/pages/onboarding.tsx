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
  CURRENCIES,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_TIMEZONE,
  LANGUAGES,
  TIMEZONES,
  type RegionOption,
} from '@/lib/region-data';
import { usePageTitle } from '@/lib/use-page-title';

function options(list: RegionOption[]) {
  return list.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}

/** Store setup — .template/onboarding.html (step 2 of the registration flow).
 * Reached via the guard for sessions that have not completed their first run. */
export function OnboardingPage() {
  usePageTitle('Set up your store');
  const navigate = useNavigate();
  const { store, preferences, updateStore, updatePreferences, refresh } = useAuth();

  const [name, setName] = useState(store?.name ?? '');
  const [country, setCountry] = useState(store?.countryCode ?? DEFAULT_COUNTRY);
  const [language, setLanguage] = useState(preferences?.locale ?? DEFAULT_LANGUAGE);
  const [currency, setCurrency] = useState(preferences?.displayCurrency ?? DEFAULT_CURRENCY);
  const [timezone, setTimezone] = useState(store?.timezone ?? DEFAULT_TIMEZONE);
  // ponytail: catalog size has no API field; kept for template fidelity.
  const [catalogSize, setCatalogSize] = useState('small');
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Saving the store region is what completes the first run.
      await updateStore({ name, country, timezone });
      if (language !== preferences?.locale || currency !== preferences?.displayCurrency) {
        await updatePreferences({ locale: language, displayCurrency: currency });
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
      <p className="intro">Start with English and USD, or choose your store’s region.</p>
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
            help="ISO country choices. No currency is inferred or converted."
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
          <Field
            error={fieldError('currency')}
            help="Amounts display in this currency after integration."
            label="Store currency"
          >
            <Select onChange={(event) => setCurrency(event.target.value)} value={currency}>
              {options(CURRENCIES)}
            </Select>
          </Field>
          <Field
            error={fieldError('timezone')}
            help="Used for sales windows and delivery-date cutoffs."
            label="Store timezone"
          >
            <Select onChange={(event) => setTimezone(event.target.value)} value={timezone}>
              {options(TIMEZONES)}
            </Select>
          </Field>
        </div>
        <Field label="Catalog size">
          <Select onChange={(event) => setCatalogSize(event.target.value)} value={catalogSize}>
            <option value="small">Up to 250 products</option>
            <option value="medium">251 to 1,000 products</option>
            <option value="large">More than 1,000 products</option>
          </Select>
        </Field>
        {error && !error.field && (
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
          Country, language, currency, and timezone are saved exactly as chosen. Nothing is
          translated, converted, or inferred.
        </span>
      </p>
    </AuthLayout>
  );
}
