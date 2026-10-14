// src/app/providers/AuthProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  login as loginRequest,
  logout as logoutRequest,
  refresh as refreshRequest,
  type AuthSession,
} from '../../api/auth';
import { registerAuthBridge } from '../../api/authBridge';
import { apiFetch } from '../../api/http';
import { isRole, type AuthUser, type Role } from '../../entities/authModel';

// Re-exported so existing `import { Role } from '.../AuthProvider'` keeps working.
export type { AuthUser, Role };

/* ---------------------------------- types ---------------------------------- */

interface AuthContextValue {
  user: AuthUser | null;
  /** In-memory access token. Never persisted to storage. */
  token: string | null;
  /** true once we've tried to restore the session (from the refresh cookie). */
  isInitialized: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/* --------------------------------- JWT utils ------------------------------- */

interface JwtPayload {
  sub?: string;
  role?: unknown;
  company_id?: string;
  fullName?: string;
}

/** base64url -> string, UTF-8 safe (plain atob() garbles Cyrillic). */
function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeToken(token: string): AuthUser | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const claims = JSON.parse(decodeBase64Url(payload)) as JwtPayload;

    if (!claims.sub || !isRole(claims.role)) return null;

    return {
      id: claims.sub,
      companyId: claims.company_id ?? '',
      role: claims.role,
      fullName: claims.fullName,
    };
  } catch {
    return null;
  }
}

/* -------------------------------- session ---------------------------------- */

interface SessionState {
  token: string;
  /** epoch ms when the accessToken expires */
  expiresAt: number;
}

const REFRESH_LEAD_MS = 60_000; // refresh 1 minute before expiry

const AuthContext = createContext<AuthContextValue | null>(null);

/* -------------------------------- provider --------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<SessionState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // The ref is the source of truth for the auth bridge. It is written
  // SYNCHRONOUSLY together with the state (see `commitSession`), never from an
  // effect: child effects run before the provider's effects, so an effect-based
  // ref would still be null for the first requests after login.
  const sessionRef = useRef<SessionState | null>(null);

  // Deduplicate concurrent refreshes within this tab (many 401s in parallel).
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const commitSession = useCallback((next: SessionState | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Drop the session AND everything cached for the previous user. */
  const clearSession = useCallback(() => {
    commitSession(null);
    queryClient.clear();
  }, [commitSession, queryClient]);

  const user = useMemo<AuthUser | null>(
    () => (session ? decodeToken(session.token) : null),
    [session],
  );

  /** Returns false when the token is unusable (no/unknown role, bad format). */
  const applySession = useCallback(
    (s: AuthSession): boolean => {
      if (!decodeToken(s.accessToken)) return false;
      commitSession({
        token: s.accessToken,
        expiresAt: Date.now() + s.expiresIn * 1000,
      });
      return true;
    },
    [commitSession],
  );

  /* Refresh routine shared by the bootstrap effect, the proactive timer,
     and the http layer (via authBridge). Cross-tab safety lives in
     `refreshRequest` (Web Locks). */
  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        const next = await refreshRequest();
        if (!next || !applySession(next)) {
          clearSession();
          return null;
        }
        return next.accessToken;
      } catch {
        // Network / 5xx: keep whatever we have, the caller decides what to do.
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [applySession, clearSession]);

  /* Register the bridge so apiFetch can read the token / trigger refresh. */
  useEffect(() => {
    registerAuthBridge({
      getToken: () => sessionRef.current?.token ?? null,
      refresh: doRefresh,
      signOut: clearSession,
    });
  }, [doRefresh, clearSession]);

  /* DEV only: console helpers to check the refresh flow without waiting 15 min.
       __auth.breakAccessToken()  -> next API call gets 401, refreshes, replays
       __auth.refreshNow()        -> force a refresh right now
       __auth.fetch('/api/...')   -> apiFetch (what all API calls should use)
       __auth.token()             -> current access token */
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const w = window as unknown as { __auth?: Record<string, unknown> };
    w.__auth = {
      breakAccessToken: () => {
        // Only the ref is touched, so the UI keeps the user signed in while the
        // next request carries a garbage token.
        if (sessionRef.current) {
          sessionRef.current = { ...sessionRef.current, token: 'broken.token.value' };
        }
      },
      refreshNow: doRefresh,
      fetch: apiFetch,
      token: () => sessionRef.current?.token ?? null,
    };

    return () => {
      delete w.__auth;
    };
  }, [doRefresh]);

  /* 1. Restore session on first mount using the refresh cookie. */
  useEffect(() => {
    let cancelled = false;

    void doRefresh().then(() => {
      if (!cancelled) setIsInitialized(true);
    });

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 2. Proactively refresh shortly before the access token expires. */
  useEffect(() => {
    if (!session) return;

    const delay = Math.max(
      0,
      session.expiresAt - Date.now() - REFRESH_LEAD_MS,
    );

    const id = window.setTimeout(() => {
      void doRefresh();
    }, delay);

    return () => window.clearTimeout(id);
  }, [session, doRefresh]);

  /* 3. Public API. */
  const login = useCallback(
    async (phone: string, password: string) => {
      const next = await loginRequest({ phone, password });
      // Never mix the previous user's cache with the new session.
      queryClient.clear();
      if (!applySession(next)) {
        throw new Error('Сервер вернул некорректный токен');
      }
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Forget the access token and the cache regardless of network result.
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: session?.token ?? null,
      isInitialized,
      login,
      logout,
    }),
    [user, session, isInitialized, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}