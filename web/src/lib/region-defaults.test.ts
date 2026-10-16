import { describe, expect, it } from 'vitest';

import {
  COUNTRIES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  TIMEZONES,
} from '@/lib/region-data';
import { COUNTRY_DEFAULTS, countryDefaults } from '@/lib/region-defaults';

describe('country defaults (onboarding derivation)', () => {
  it('covers every country the app offers', () => {
    const missing = COUNTRIES.filter((option) => !COUNTRY_DEFAULTS[option.value]).map(
      (option) => option.value,
    );
    expect(missing).toEqual([]);
    expect(Object.keys(COUNTRY_DEFAULTS)).toEqual(
      expect.arrayContaining(COUNTRIES.map((option) => option.value)),
    );
  });

  it('only proposes currencies and timezones the app actually offers (backend validates the same lists)', () => {
    const badCurrency = Object.entries(COUNTRY_DEFAULTS)
      .filter(([, entry]) => !CURRENCIES.some((option) => option.value === entry[0]))
      .map(([code, entry]) => `${code}→${entry[0]}`);
    const badZone = Object.entries(COUNTRY_DEFAULTS)
      .filter(([, entry]) => !TIMEZONES.some((option) => option.value === entry[1]))
      .map(([code, entry]) => `${code}→${entry[1]}`);
    expect(badCurrency).toEqual([]);
    expect(badZone).toEqual([]);
  });

  it('derives the documented defaults, including multi-timezone countries', () => {
    expect(countryDefaults('US')).toEqual({ currency: 'USD', timezone: 'America/New_York' });
    expect(countryDefaults('AU')).toEqual({ currency: 'AUD', timezone: 'Australia/Sydney' });
    // Multi-timezone countries: one defensible default each.
    expect(countryDefaults('CA')).toEqual({ currency: 'CAD', timezone: 'America/Toronto' });
    expect(countryDefaults('RU')).toEqual({ currency: 'RUB', timezone: 'Europe/Moscow' });
    expect(countryDefaults('FR')).toEqual({ currency: 'EUR', timezone: 'Europe/Paris' });
    expect(countryDefaults('DE')).toEqual({ currency: 'EUR', timezone: 'Europe/Berlin' });
    expect(countryDefaults('ID')).toEqual({ currency: 'IDR', timezone: 'Asia/Jakarta' });
    expect(countryDefaults('JP')).toEqual({ currency: 'JPY', timezone: 'Asia/Tokyo' });
    expect(countryDefaults('GB')).toEqual({ currency: 'GBP', timezone: 'Europe/London' });
    expect(countryDefaults('SG')).toEqual({ currency: 'SGD', timezone: 'Asia/Singapore' });
  });

  it('falls back to the honest app defaults for unknown countries instead of guessing', () => {
    expect(countryDefaults('ZZ')).toEqual({
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE,
    });
    expect(countryDefaults('')).toEqual({
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE,
    });
  });
});
