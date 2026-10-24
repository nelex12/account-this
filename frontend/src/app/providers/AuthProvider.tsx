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
import { deleteCertificate } from '../../offline/certs';
import {
  clearIdentity,
  clearPendingLogout,
  hasPendingLogout,
  loadIdentity,
  markPendingLogout,
  saveIdentity,
} from '../../offline/identity';
import { clearRegistry } from '../../offline/registry';

// Re-exported so existing `import { Role } from '.../AuthProvider'` keeps working.
export type { AuthUser, Role };

/* ---------------------------------- types ---------------------------------- */

interface AuthContextValue {
  user: AuthUser | null;
  /** In-memory access token. Never persisted to storage. */
  token: string | null;
  /** true once we've tried to restore the session (from the refresh cookie). */
  isInitialized: boolean;
  /**
   * true while the app runs on the identity remembered on this device (no server session yet:
   * it was started without a network). Offline features work; server requests wait for a session.
   */
  isOfflineSession: boolean;
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
/** With a remembered identity, how long the start waits for the server before opening offline. */
const OFFLINE_START_WAIT_MS = 3_000;

/** How the last refresh ended: 'denied' = the server said the session is over (401/403). */
type RefreshOutcome = 'ok' | 'denied' | 'network';

const AuthContext = createContext<AuthContextValue | null>(null);

/* -------------------------------- provider --------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<SessionState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Remembered identity, used only while there is no server session (started offline).
  const [offlineUser, setOfflineUser] = useState<AuthUser | null>(null);
  const offlineUserRef = useRef<AuthUser | null>(null);
  const refreshOutcomeRef = useRef<RefreshOutcome | undefined>(undefined);

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
    offlineUserRef.current = null;
    setOfflineUser(null);
    queryClient.clear();
    void clearIdentity().catch(() => {});
  }, [commitSession, queryClient]);

  const user = useMemo<AuthUser | null>(
    () => (session ? decodeToken(session.token) : offlineUser),
    [session, offlineUser],
  );

  /** Returns false when the token is unusable (no/unknown role, bad format). */
  const applySession = useCallback(
    (s: AuthSession): boolean => {
      const decoded = decodeToken(s.accessToken);
      if (!decoded) return false;
      offlineUserRef.current = null;
      setOfflineUser(null);
      void saveIdentity(decoded).catch(() => {});
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
          refreshOutcomeRef.current = 'denied';
          clearSession();
          return null;
        }
        refreshOutcomeRef.current = 'ok';
        return next.accessToken;
      } catch {
        // Network / 5xx: keep whatever we have, the caller decides what to do.
        refreshOutcomeRef.current = 'network';
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
      // A request got 401 and the refresh then failed for lack of network: that is NOT the end of
      // the session. Signing out here would throw away the remembered identity in the middle of
      // offline work.
      signOut: () => {
        if (refreshOutcomeRef.current === 'network') return;
        clearSession();
      },
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

  /* If "logout" was pressed offline, tell the server as soon as it can hear us: otherwise the refresh
     cookie would sign the same person in again at the next start. Returns true when it is settled. */
  const flushPendingLogout = useCallback(async (): Promise<boolean> => {
    try {
      if (!(await hasPendingLogout())) return true;
      await logoutRequest();
      await clearPendingLogout();
      return true;
    } catch {
      return false;
    }
  }, []);

  /* 1. Restore session on first mount using the refresh cookie.
        Started with no network: open on the remembered identity (Worker/Issuer), see offline/identity.ts. */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!(await flushPendingLogout())) {
        // signed out on this device and the server cannot be told yet: stay signed out
        if (!cancelled) setIsInitialized(true);
        return;
      }
      const identity = await loadIdentity().catch(() => null);
      const refreshing = doRefresh();
      if (identity) {
        await Promise.race([refreshing, new Promise((r) => setTimeout(r, OFFLINE_START_WAIT_MS))]);
      } else {
        await refreshing;
      }
      if (cancelled) return;
      if (identity && !sessionRef.current && refreshOutcomeRef.current !== 'denied') {
        offlineUserRef.current = identity;
        setOfflineUser(identity);
      }
      setIsInitialized(true);
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The connection is back: finish a logout done offline, and turn the remembered identity (or an
     expired token) into a real session. */
  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        if (!(await flushPendingLogout())) return;
        const expired = sessionRef.current && sessionRef.current.expiresAt < Date.now() + REFRESH_LEAD_MS;
        if (offlineUserRef.current || expired) await doRefresh();
      })();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [doRefresh, flushPendingLogout]);

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
      void clearPendingLogout().catch(() => {});
      if (!applySession(next)) {
        throw new Error('Сервер вернул некорректный токен');
      }
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    // an explicit sign-out also removes the worker's offline signing key from this device
    const userId =
      (sessionRef.current ? decodeToken(sessionRef.current.token)?.id : undefined) ?? offlineUserRef.current?.id;
    try {
      await logoutRequest();
    } catch {
      // No network: sign out here anyway, and tell the server later (flushPendingLogout).
      await markPendingLogout().catch(() => {});
    } finally {
      // Forget the access token and the cache regardless of network result.
      clearSession();
      if (userId) void deleteCertificate(userId).catch(() => {});
      // The registry is a copy of the company's tools: do not leave it for the next person on the device.
      // The journal stays: unsent records must survive a logout.
      void clearRegistry().catch(() => {});
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: session?.token ?? null,
      isInitialized,
      isOfflineSession: session === null && offlineUser !== null,
      login,
      logout,
    }),
    [user, session, offlineUser, isInitialized, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}