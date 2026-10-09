// src/app/providers/AuthProvider.tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Role = 'Owner' | 'Issuer' | 'Worker';

export interface AuthUser {
  id: number;
  fullName: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Current JWT. null with the fake login; later it goes into the Bearer header. */
  token: string | null;
  /** DEV STUB: signs in as a fake user with the given role. Replace with the real login. */
  loginAs: (role: Role) => void;
  logout: () => void;
}

const STORAGE_KEY = 'auth';

const fakeUsers: Record<Role, AuthUser> = {
  Owner: { id: 1, fullName: 'Петров Андрей Сергеевич', role: 'Owner' },
  Issuer: { id: 2, fullName: 'Сидоров Павел Иванович', role: 'Issuer' },
  Worker: { id: 3, fullName: 'Иванов Иван Иванович', role: 'Worker' },
};

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: read storage once, so a refresh keeps you signed in
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const loginAs = useCallback((role: Role) => {
    const next = fakeUsers[role];
    setUser(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token: null, loginAs, logout }),
    [user, loginAs, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}