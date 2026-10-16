import type {
  AuthCredentials,
  AuthResult,
  MeOut,
  Preferences,
  PreferencesResult,
  PreferencesUpdateInput,
  RegisterInput,
  Store,
  StoreResult,
  StoreUpdateInput,
  StoreWithPreferences,
  User,
} from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { COUNTRIES, CURRENCIES, LANGUAGES, TIMEZONES } from '@/lib/region-data';

/**
 * In-memory auth/session layer for VITE_USE_MOCK, mirroring the backend
 * contract in src/lib/api.ts: register/login start a session, me() reads it,
 * logout clears it, expectedVersion mismatches 409 with currentVersion, and
 * unknown region codes 400 with the offending field. Nothing persists across
 * a page reload — the real backend owns durability.
 */

interface MockAccount {
  password: string;
  user: User;
  store: Store;
  preferences: Preferences;
}

const accounts = new Map<string, MockAccount>();
let session: MockAccount | null = null;
let userCounter = 0;

const FIELD_OPTIONS = {
  country: COUNTRIES,
  language: LANGUAGES,
  currency: CURRENCIES,
  timezone: TIMEZONES,
} as const;

type RegionField = keyof typeof FIELD_OPTIONS;

/** Small async delay so the UI's saving/pending states are observable. */
// Promise.withResolvers is ES2024 (tsconfig lib is ES2022); setTimeout
// completion is the documented executor-form exception.
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

function validateRegion(field: RegionField, value: string): void {
  if (!FIELD_OPTIONS[field].some((option) => option.value === value)) {
    throw new ApiError(400, `Unknown ${field}: ${value}`, { code: 'invalid_value', field });
  }
}

function requireSession(): MockAccount {
  if (!session) throw new ApiError(401, 'Not authenticated', { code: 'unauthenticated' });
  return session;
}

function authResult(account: MockAccount): AuthResult {
  return {
    user: account.user,
    store: account.store,
    preferences: account.preferences,
  };
}

export async function mockLogin(input: AuthCredentials): Promise<AuthResult> {
  await settle();
  const account = accounts.get(input.email);
  if (!account || account.password !== input.password) {
    throw new ApiError(401, 'Email or password is incorrect.', { code: 'invalid_credentials' });
  }
  session = account;
  return authResult(account);
}

export async function mockRegister(input: RegisterInput): Promise<AuthResult> {
  await settle();
  if (accounts.has(input.email)) {
    throw new ApiError(409, 'An account with this email already exists.', {
      code: 'email_exists',
      field: 'email',
    });
  }
  validateRegion('country', input.country);
  validateRegion('language', input.language);
  validateRegion('currency', input.currency);
  validateRegion('timezone', input.timezone);
  userCounter += 1;
  const account: MockAccount = {
    password: input.password,
    user: { id: `user-${userCounter}`, email: input.email, role: 'owner' },
    store: {
      id: `store-${userCounter}`,
      name: input.storeName,
      countryCode: input.country,
      locale: input.language,
      defaultCurrency: input.currency,
      timezone: input.timezone,
      version: 1,
      firstRunComplete: false,
    },
    preferences: {
      locale: input.language,
      displayCurrency: input.currency,
      timezone: input.timezone,
      dateFormat: 'mdy',
      numberFormat: 'en',
      version: 1,
    },
  };
  accounts.set(input.email, account);
  session = account;
  return authResult(account);
}

export async function mockMe(): Promise<MeOut> {
  const account = requireSession();
  return { ...authResult(account), firstRunComplete: account.store.firstRunComplete };
}

export async function mockLogout(): Promise<void> {
  await settle();
  session = null;
}

export function mockGetStore(): StoreWithPreferences {
  const account = requireSession();
  return { store: account.store, preferences: account.preferences };
}

export async function mockUpdateStore(input: StoreUpdateInput): Promise<StoreResult> {
  await settle();
  const account = requireSession();
  if (account.store.version !== input.expectedVersion) {
    throw new ApiError(409, 'The store changed since you loaded it.', {
      code: 'version_conflict',
      currentVersion: account.store.version,
    });
  }
  if (input.country !== undefined) validateRegion('country', input.country);
  if (input.locale !== undefined) validateRegion('language', input.locale);
  if (input.timezone !== undefined) validateRegion('timezone', input.timezone);
  const store: Store = { ...account.store, version: account.store.version + 1 };
  if (input.name !== undefined) store.name = input.name;
  if (input.country !== undefined) store.countryCode = input.country;
  if (input.locale !== undefined) store.locale = input.locale;
  if (input.defaultCurrency !== undefined) store.defaultCurrency = input.defaultCurrency;
  if (input.timezone !== undefined) store.timezone = input.timezone;
  if (input.completeFirstRun && !store.firstRunComplete) {
    // Explicit, one-way onboarding completion — mirrors POST /api/store.
    store.firstRunComplete = true;
  }
  account.store = store;
  return { store, version: store.version };
}

export async function mockUpdatePreferences(
  input: PreferencesUpdateInput,
): Promise<PreferencesResult> {
  await settle();
  const account = requireSession();
  if (account.preferences.version !== input.expectedVersion) {
    throw new ApiError(409, 'Your preferences changed since you loaded them.', {
      code: 'version_conflict',
      currentVersion: account.preferences.version,
    });
  }
  if (input.locale !== undefined) validateRegion('language', input.locale);
  if (input.displayCurrency !== undefined) validateRegion('currency', input.displayCurrency);
  if (input.timezone !== undefined) validateRegion('timezone', input.timezone);
  const preferences: Preferences = {
    ...account.preferences,
    version: account.preferences.version + 1,
  };
  if (input.locale !== undefined) preferences.locale = input.locale;
  if (input.displayCurrency !== undefined) preferences.displayCurrency = input.displayCurrency;
  if (input.timezone !== undefined) preferences.timezone = input.timezone;
  if (input.dateFormat !== undefined) preferences.dateFormat = input.dateFormat;
  if (input.numberFormat !== undefined) preferences.numberFormat = input.numberFormat;
  account.preferences = preferences;
  return { preferences, version: preferences.version };
}
