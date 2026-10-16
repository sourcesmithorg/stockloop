import type {
  AddMemberInput,
  AuthCredentials,
  AuthResult,
  MemberResult,
  MeOut,
  Preferences,
  PreferencesResult,
  PreferencesUpdateInput,
  RegisterInput,
  Store,
  StoreMember,
  StoreResult,
  StoreRole,
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

/**
 * Read-only demo account (fixture, like the backend's seeded owner — not a
 * real credential): exists so role-gated actions can be exercised in demo
 * mode exactly as the backend's viewer role gates them.
 */
accounts.set('viewer@stockloop.test', {
  password: 'Stockloop123!',
  user: { id: 'user-viewer-demo', email: 'viewer@stockloop.test', role: 'viewer' },
  store: {
    id: 'store-demo-view',
    name: 'Maple & Main',
    countryCode: 'US',
    locale: 'en',
    defaultCurrency: 'USD',
    timezone: 'UTC',
    version: 1,
    firstRunComplete: true,
  },
  preferences: {
    locale: 'en',
    displayCurrency: 'USD',
    timezone: 'UTC',
    dateFormat: 'mdy',
    numberFormat: 'en',
    version: 1,
  },
});

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

// ---- Store members (GET/POST/PATCH/DELETE /store/members) ------------------

const membersByStore = new Map<string, StoreMember[]>();

/** The session user's row is seeded lazily; the backend owns real scoping. */
function storeMembers(account: MockAccount): StoreMember[] {
  let members = membersByStore.get(account.store.id);
  if (!members) {
    members = [
      {
        id: account.user.id,
        email: account.user.email,
        role: account.user.role as StoreRole,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    membersByStore.set(account.store.id, members);
  }
  return members;
}

function requireOwner(account: MockAccount): void {
  if (account.user.role !== 'owner') {
    throw new ApiError(403, 'Only the store owner can manage members.', { code: 'forbidden' });
  }
}

function activeOwnerCount(members: StoreMember[]): number {
  return members.filter((member) => member.role === 'owner' && member.status === 'active').length;
}

const noEmailSent = (email: string): string =>
  `Membership recorded for ${email}. No email was sent — nobody was contacted; tell them yourself.`;

export async function mockGetStoreMembers(): Promise<StoreMember[]> {
  await settle();
  const account = requireSession();
  return storeMembers(account).map((member) => ({ ...member }));
}

export async function mockAddStoreMember(input: AddMemberInput): Promise<MemberResult> {
  await settle();
  const account = requireSession();
  requireOwner(account);
  if (input.role !== 'owner' && input.role !== 'operator' && input.role !== 'viewer') {
    throw new ApiError(400, `Unknown role: ${input.role}`, { code: 'invalid_role', field: 'role' });
  }
  const members = storeMembers(account);
  const email = input.email.trim().toLowerCase();
  if (members.some((member) => member.email === email && member.status === 'active')) {
    throw new ApiError(409, 'This email is already an active member of the store.', {
      code: 'already_member',
      field: 'email',
    });
  }
  const target = accounts.get(email);
  if (!target) {
    throw new ApiError(404, 'No account exists for that email — they must register first.', {
      code: 'user_not_found',
      field: 'email',
    });
  }
  const member: StoreMember = {
    id: target.user.id,
    email: target.user.email,
    role: input.role,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  // Re-inviting a revoked member reactivates their row instead of duplicating it.
  const index = members.findIndex((row) => row.id === member.id);
  if (index >= 0) members[index] = member;
  else members.push(member);
  return { member: { ...member }, notified: false, message: noEmailSent(email) };
}

export async function mockUpdateStoreMemberRole(
  userId: string,
  role: StoreRole,
): Promise<StoreMember> {
  await settle();
  const account = requireSession();
  requireOwner(account);
  if (role !== 'owner' && role !== 'operator' && role !== 'viewer') {
    throw new ApiError(400, `Unknown role: ${role}`, { code: 'invalid_role', field: 'role' });
  }
  const members = storeMembers(account);
  const member = members.find((row) => row.id === userId && row.status === 'active');
  if (!member) {
    throw new ApiError(404, 'That person is not an active member of the store.', {
      code: 'member_not_found',
    });
  }
  if (member.role === 'owner' && role !== 'owner' && activeOwnerCount(members) === 1) {
    throw new ApiError(409, 'The store needs at least one active owner.', { code: 'last_owner' });
  }
  member.role = role;
  return { ...member };
}

export async function mockRevokeStoreMember(userId: string): Promise<void> {
  await settle();
  const account = requireSession();
  requireOwner(account);
  const members = storeMembers(account);
  const member = members.find((row) => row.id === userId && row.status === 'active');
  if (!member) {
    throw new ApiError(404, 'That person is not an active member of the store.', {
      code: 'member_not_found',
    });
  }
  if (member.role === 'owner' && activeOwnerCount(members) === 1) {
    throw new ApiError(409, 'The store needs at least one active owner.', { code: 'last_owner' });
  }
  member.status = 'revoked';
}
