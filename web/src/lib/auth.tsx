import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  api,
  ApiError,
  type AuthCredentials,
  type MeOut,
  type Preferences,
  type PreferencesResult,
  type RegisterInput,
  type Store,
  type StoreResult,
  type User,
} from '@/lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Store fields the provider lets screens change; versions stay internal. */
export interface StorePatch {
  name?: string;
  country?: string;
  locale?: string;
  defaultCurrency?: string;
  timezone?: string;
}

/** Preference fields the provider lets screens change; versions stay internal. */
export interface PreferencesPatch {
  locale?: string;
  displayCurrency?: string;
  timezone?: string;
  dateFormat?: string;
  numberFormat?: string;
}

export interface AuthContextValue {
  user: User | null;
  store: Store | null;
  preferences: Preferences | null;
  firstRunComplete: boolean;
  status: AuthStatus;
  login(credentials: AuthCredentials): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  /** Re-reads /api/auth/me; throws so callers can surface their own failure. */
  refresh(): Promise<void>;
  updateStore(input: StorePatch): Promise<StoreResult>;
  updatePreferences(input: PreferencesPatch): Promise<PreferencesResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state for the whole app: reads the cookie-backed session via
 * me() on mount, exposes login/register/logout, and keeps the current
 * store/preferences (with their optimistic-concurrency versions) so screens
 * never juggle expectedVersion themselves. A 401 on any authed call moves
 * status to 'unauthenticated'; the route guard in App.tsx does the redirect.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MeOut | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  // Version-sensitive calls read the freshest copy even before React
  // re-renders: refresh() updates these synchronously, so a conflict retry
  // never re-sends a stale expectedVersion.
  const storeRef = useRef<Store | null>(null);
  const preferencesRef = useRef<Preferences | null>(null);

  const apply = useCallback((me: MeOut) => {
    storeRef.current = me.store;
    preferencesRef.current = me.preferences;
    setSession(me);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    storeRef.current = null;
    preferencesRef.current = null;
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.me());
    } catch (error) {
      // Session gone (401) or backend unreachable: fall back to unauthenticated
      // so the guard can route to /login; callers still receive the error.
      clear();
      throw error;
    }
  }, [apply, clear]);

  useEffect(() => {
    // The state transition inside refresh() is the error handling here.
    void refresh().catch(() => undefined);
  }, [refresh]);

  const login = useCallback(
    async (credentials: AuthCredentials) => {
      const result = await api.login(credentials);
      // Login responses carry no firstRunComplete — me() below is authoritative.
      apply({ ...result, firstRunComplete: false });
      await refresh();
    },
    [apply, refresh],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await api.register(input);
      apply({ ...result, firstRunComplete: false });
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clear();
    }
  }, [clear]);

  const updateStore = useCallback(
    async (input: StorePatch): Promise<StoreResult> => {
      const current = storeRef.current;
      if (!current) throw new ApiError(401, 'No store is loaded for this session');
      try {
        const result = await api.updateStore({ ...input, expectedVersion: current.version });
        storeRef.current = result.store;
        setSession((previous) => (previous ? { ...previous, store: result.store } : previous));
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) clear();
        throw error;
      }
    },
    [clear],
  );

  const updatePreferences = useCallback(
    async (input: PreferencesPatch): Promise<PreferencesResult> => {
      const current = preferencesRef.current;
      if (!current) throw new ApiError(401, 'No preferences are loaded for this session');
      try {
        const result = await api.updatePreferences({
          ...input,
          expectedVersion: current.version,
        });
        preferencesRef.current = result.preferences;
        setSession((previous) =>
          previous ? { ...previous, preferences: result.preferences } : previous,
        );
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) clear();
        throw error;
      }
    },
    [clear],
  );

  const value: AuthContextValue = {
    user: session?.user ?? null,
    store: session?.store ?? null,
    preferences: session?.preferences ?? null,
    firstRunComplete: session?.firstRunComplete ?? false,
    status,
    login,
    register,
    logout,
    refresh,
    updateStore,
    updatePreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}
