import { useState } from 'react';

import { PageHead } from '@/components/layout/page-head';
import { Icon } from '@/components/layout/icon';
import { Button, Field, InlineNote, Select } from '@/components/ui';
import { ApiError, type Preferences, type Store } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { COUNTRIES, CURRENCIES, LANGUAGES, TIMEZONES } from '@/lib/region-data';
import { usePageTitle } from '@/lib/use-page-title';

/** Regional settings — .template/settings.html (#region). Country and display
 * currency are independent: changing one never rewrites the other (T-05). */
export function SettingsPage() {
  usePageTitle('Settings');
  const { store, preferences } = useAuth();
  return (
    <>
      <PageHead
        description="Practical preferences for the way your store works."
        eyebrow="Settings"
        title="Make yourself at home."
      />
      {store && preferences ? (
        <RegionForm initialPreferences={preferences} initialStore={store} />
      ) : (
        <p className="small muted">Loading settings…</p>
      )}
    </>
  );
}

interface FormState {
  country: string;
  language: string;
  currency: string;
  timezone: string;
}

type SavePhase = 'idle' | 'saving' | 'success' | 'error' | 'conflict';

interface SaveState {
  phase: SavePhase;
  message?: string;
  currentVersion?: number;
}

function RegionForm({
  initialStore,
  initialPreferences,
}: {
  initialStore: Store;
  initialPreferences: Preferences;
}) {
  const { updateStore, updatePreferences, refresh } = useAuth();

  const [country, setCountry] = useState(initialStore.countryCode);
  const [language, setLanguage] = useState(initialPreferences.locale);
  const [currency, setCurrency] = useState(initialPreferences.displayCurrency);
  const [timezone, setTimezone] = useState(initialStore.timezone);
  // Last known-saved form state: dirty = any field differs from it.
  const [baseline, setBaseline] = useState<FormState>({
    country: initialStore.countryCode,
    language: initialPreferences.locale,
    currency: initialPreferences.displayCurrency,
    timezone: initialStore.timezone,
  });
  const [save, setSave] = useState<SaveState>({ phase: 'idle' });

  const dirty =
    country !== baseline.country ||
    language !== baseline.language ||
    currency !== baseline.currency ||
    timezone !== baseline.timezone;

  function touch<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setSave({ phase: 'idle' });
  }

  async function handleSave() {
    setSave({ phase: 'saving' });
    try {
      if (save.phase === 'conflict') {
        // Version conflict: re-fetch the latest versions, then re-apply this
        // form's values (the inputs stay untouched on screen).
        await refresh();
      }
      const storePatch: { country?: string; timezone?: string } = {};
      if (country !== baseline.country) storePatch.country = country;
      if (timezone !== baseline.timezone) storePatch.timezone = timezone;
      const preferencesPatch: { locale?: string; displayCurrency?: string } = {};
      if (language !== baseline.language) preferencesPatch.locale = language;
      if (currency !== baseline.currency) preferencesPatch.displayCurrency = currency;
      if (Object.keys(storePatch).length > 0) await updateStore(storePatch);
      if (Object.keys(preferencesPatch).length > 0) await updatePreferences(preferencesPatch);
      setBaseline({ country, language, currency, timezone });
      setSave({ phase: 'success' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSave({ phase: 'conflict', currentVersion: caught.currentVersion });
      } else {
        setSave({
          phase: 'error',
          message:
            caught instanceof ApiError
              ? caught.message
              : 'Could not save your changes. Check your connection and retry.',
        });
      }
    }
  }

  const statusText =
    save.phase === 'saving'
      ? 'Saving…'
      : save.phase === 'error'
        ? save.message
        : save.phase === 'conflict'
          ? `Version conflict — someone else changed this store (current version ${
              save.currentVersion ?? 'unknown'
            }). Retry re-loads it, then saves your changes.`
          : dirty
            ? 'Unsaved changes.'
            : save.phase === 'success'
              ? 'Changes saved.'
              : 'No unsaved changes.';

  return (
    <div className="settings-grid">
      <section className="panel panel-pad settings-section" id="region">
        <h2>Your region. Your terms.</h2>
        <p className="muted">
          Country and currency are independent preferences. English and USD are the defaults.
        </p>
        <div className="field-grid two">
          <Field
            help="ISO country choices. No currency is inferred or converted."
            label="Store country"
          >
            <Select onChange={(event) => touch(setCountry, event.target.value)} value={country}>
              {COUNTRIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            help="The screens remain English until translations exist."
            label="Interface language"
          >
            <Select onChange={(event) => touch(setLanguage, event.target.value)} value={language}>
              {LANGUAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            help="Amounts display in this currency after integration."
            label="Display currency"
          >
            <Select onChange={(event) => touch(setCurrency, event.target.value)} value={currency}>
              {CURRENCIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field help="Used for sales windows and delivery-date cutoffs." label="Store timezone">
            <Select onChange={(event) => touch(setTimezone, event.target.value)} value={timezone}>
              {TIMEZONES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-24">
          <InlineNote tone="warn" title="Changing currency is not currency conversion.">
            Keep historic orders in their original currency. Resolve supplier-currency mismatches
            before approval; do not re-label previous amounts.
          </InlineNote>
        </div>
        <div className="form-actions">
          <span aria-live="polite" className="small muted" role="status">
            {statusText}
          </span>
          <Button
            disabled={!dirty}
            loading={save.phase === 'saving'}
            loadingLabel="Saving…"
            onClick={() => {
              void handleSave();
            }}
            type="button"
            variant="primary"
          >
            <Icon name="i-check" />
            {save.phase === 'error' || save.phase === 'conflict' ? 'Retry save' : 'Save changes'}
          </Button>
        </div>
      </section>
    </div>
  );
}
