// src/api/profile.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../app/providers/AuthProvider';
import type { AuthUser } from '../entities/authModel';
import type { ProfileData } from '../entities/profileModel';
import type { UserDto } from '../entities/usersModel';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/*
 * Profile = GET /api/users/me (any role: id, fullName, phone, role, ...)
 *         + GET /api/companies/my (company name).
 */

/** GET /api/users/me — 200 UserResponse, 401 no/expired token, 404 (never in practice). */
export async function getMe(): Promise<UserDto | undefined> {
  const response = await apiFetch('/api/users/me');
  if (!response.ok) return undefined;
  return (await response.json()) as UserDto;
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
  const [me, companyName] = await Promise.all([
    orFallback(getMe(), undefined),
    orFallback(loadCompanyName(), undefined),
  ]);

  return {
    id: user.id,
    // the server is the source of truth; token values are the fallback
    role: me?.role ?? user.role,
    fullName: me?.fullName || user.fullName,
    phone: me?.phone,
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
    // Name/phone/company practically never change.
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}