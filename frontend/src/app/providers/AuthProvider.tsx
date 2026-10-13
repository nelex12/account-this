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

import {
  login as loginRequest,
  logout as logoutRequest,
  refresh as refreshRequest,
  type AuthSession,
} from '../../api/auth';
import { registerAuthBridge } from '../../api/authBridge';

/* ---------------------------------- types ---------------------------------- */

export type Role = 'Owner' | 'Issuer' | 'Worker';

export interface AuthUser {
  id: number;
  fullName: string;
  role: Role;
}

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
  id?: number;
  fullName?: string;
  role?: Role;
  exp?: number;
}

function decodeToken(token: string): AuthUser | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(normalized)) as JwtPayload;

    if (!json.role) return null;

    return {
      id: json.id ?? Number(json.sub ?? 0),
      fullName: json.fullName ?? '',
      role: json.role,
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
  const [session, setSession] = useState<SessionState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Keep the latest session in a ref so the auth bridge always reads fresh
  // values without needing to re-register on every state change.
  const sessionRef = useRef<SessionState | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Deduplicate concurrent refreshes (e.g. many 401s in parallel).
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const user = useMemo<AuthUser | null>(
    () => (session ? decodeToken(session.token) : null),
    [session],
  );

  const applySession = useCallback((s: AuthSession) => {
    setSession({
      token: s.accessToken,
      expiresAt: Date.now() + s.expiresIn * 1000,
    });
  }, []);

  /* Refresh routine shared by the bootstrap effect, the proactive timer,
     and the http layer (via authBridge). */
  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        const next = await refreshRequest();
        if (!next) {
          setSession(null);
          return null;
        }
        applySession(next);
        return next.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [applySession]);

  /* Register the bridge so apiFetch can read the token / trigger refresh. */
  useEffect(() => {
    registerAuthBridge({
      getToken: () => sessionRef.current?.token ?? null,
      refresh: doRefresh,
    });
  }, [doRefresh]);

  /* 1. Restore session on first mount using the refresh cookie. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await doRefresh();
      if (cancelled) return;
      // `doRefresh` already applied the session (or cleared it).
      void token;
      setIsInitialized(true);
    })();

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
      applySession(next);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setSession(null); // forget the access token regardless of network result
    }
  }, []);

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