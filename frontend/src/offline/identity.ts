// identity.ts — who was signed in last, so the app can open with no network.
//
// Only NON-secret facts are stored (id, role, name, company). No tokens and no passwords: the access
// token lives in memory only and the refresh token is an HttpOnly cookie that JavaScript cannot see.
// So a stored identity opens the app and its OFFLINE features; anything that needs the server asks
// for a real session first (see AuthProvider).
//
// Only Worker and Issuer have offline features (QR, scanning). An Owner's pages are all server data,
// so an Owner is not remembered: offline he just sees the login page.
import { isRole, type AuthUser } from '../entities/authModel';
import { deleteMeta, getMeta, setMeta } from './meta';

export const OFFLINE_ROLES = ['Worker', 'Issuer'] as const;

export async function saveIdentity(user: AuthUser, nowMs: number = Date.now()): Promise<void> {
  if (!(OFFLINE_ROLES as readonly string[]).includes(user.role)) {
    await clearIdentity();
    return;
  }
  const previous = await getMeta('identity');
  await setMeta('identity', {
    userId: user.id,
    role: user.role,
    // the token has no name: keep the one we already know for the same user
    fullName: user.fullName ?? (previous?.userId === user.id ? previous.fullName : ''),
    companyId: user.companyId,
    savedAt: nowMs,
  });
}

export async function loadIdentity(): Promise<AuthUser | null> {
  const stored = await getMeta('identity');
  if (!stored || !stored.userId || !isRole(stored.role)) return null;
  if (!(OFFLINE_ROLES as readonly string[]).includes(stored.role)) return null;
  return {
    id: stored.userId,
    role: stored.role,
    companyId: stored.companyId ?? '',
    fullName: stored.fullName || undefined,
  };
}

export async function clearIdentity(): Promise<void> {
  await deleteMeta('identity');
}

/* ------------------------- logout done while offline ------------------------- */

/** Remember that the server still has to be told "logout" (the refresh cookie is alive). */
export async function markPendingLogout(): Promise<void> {
  await setMeta('pendingLogout', true);
}

export async function hasPendingLogout(): Promise<boolean> {
  return (await getMeta('pendingLogout')) === true;
}

export async function clearPendingLogout(): Promise<void> {
  await deleteMeta('pendingLogout');
}
