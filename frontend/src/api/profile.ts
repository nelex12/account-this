// src/api/profile.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../app/providers/AuthProvider';
import type { AuthUser } from '../entities/authModel';
import type { ProfileData } from '../entities/profileModel';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/*
 * The backend has no "current user" endpoint (yet), so the profile is
 * assembled per role:
 *   Owner  -> GET /api/users (owner is in the list of his own company): name + phone
 *   Worker -> GET /api/auth/worker-cert: `fio` inside the signed token: name only
 *   Issuer -> nothing (name only if the JWT carries a `fullName` claim)
 *   all    -> GET /api/companies/my: company name
 *
 * When the backend adds GET /api/users/me (UserResponse), replace
 * `loadIdentity` with a single fetch of it.
 */

interface Identity {
  fullName?: string;
  phone?: string;
}

/** base64url -> parsed JSON, UTF-8 safe (plain atob() garbles Cyrillic). */
function decodeBase64UrlJson(input: string): unknown {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function loadOwnerIdentity(userId: string): Promise<Identity> {
  const response = await apiFetch('/api/users');
  if (!response.ok) return {};
  const users = (await response.json()) as { id: string; fullName: string; phone: string }[];
  const me = users.find((u) => u.id === userId);
  return me ? { fullName: me.fullName, phone: me.phone } : {};
}

async function loadWorkerIdentity(): Promise<Identity> {
  const response = await apiFetch('/api/auth/worker-cert');
  if (!response.ok) return {};
  const { token } = (await response.json()) as { token?: string };
  if (!token) return {};
  const payload = decodeBase64UrlJson(token) as { fio?: unknown };
  return typeof payload.fio === 'string' ? { fullName: payload.fio } : {};
}

function loadIdentity(user: AuthUser): Promise<Identity> {
  switch (user.role) {
    case 'Owner':
      return loadOwnerIdentity(user.id);
    case 'Worker':
      return loadWorkerIdentity();
    default:
      return Promise.resolve({});
  }
}

async function loadCompanyName(): Promise<string | undefined> {
  const response = await apiFetch('/api/companies/my');
  if (!response.ok) return undefined;
  return ((await response.json()) as { name?: string }).name;
}

/** A failed extra lookup must not take the whole page down. */
async function orFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/* ------------------------------- Raw functions ------------------------------ */

export async function getProfile(user: AuthUser): Promise<ProfileData> {
  const [identity, companyName] = await Promise.all([
    orFallback(loadIdentity(user), {} as Identity),
    orFallback(loadCompanyName(), undefined),
  ]);

  return {
    id: user.id,
    role: user.role,
    // JWT claim wins if the backend ever starts sending it
    fullName: user.fullName || identity.fullName,
    phone: identity.phone,
    companyName,
  };
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.profile, user?.id],
    queryFn: () => {
      if (!user) throw new Error('Not signed in');
      return getProfile(user);
    },
    enabled: Boolean(user),
    // Name/phone/company practically never change; for Worker every refetch
    // would generate a new certificate on the server.
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}