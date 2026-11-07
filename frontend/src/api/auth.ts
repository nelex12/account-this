// src/api/auth.ts
import { useMutation } from '@tanstack/react-query';
import type { Role } from '../entities/authModel';
import { readToken, runRefresh, runSignOut } from './authBridge';
import { apiFetch } from './http';

/* ------------------------------- register ---------------------------------- */

export interface RegisterOwnerPayload {
  fullName: string;
  phone: string;
  password: string;
  role: 'Owner';
  companyName: string;
}

export interface RegisterMemberPayload {
  fullName: string;
  phone: string;
  password: string;
  role: Exclude<Role, 'Owner'>;
  companyId: string;
}

export type RegisterPayload = RegisterOwnerPayload | RegisterMemberPayload;

/* ------------------------------ shared error ------------------------------- */

interface ApiErrorBody {
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function readJson(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

/* -------------------------------- register --------------------------------- */

export async function register(payload: RegisterPayload): Promise<void> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (response.status === 201) return;

  const data = await readJson(response);

  if (response.status === 400) {
    throw new ApiError('Проверьте поля формы', 400, data?.errors);
  }
  if (response.status === 409) {
    throw new ApiError(data?.detail ?? 'Телефон уже занят', 409);
  }
  throw new ApiError(
    data?.detail ?? `Не удалось зарегистрироваться (${response.status})`,
    response.status,
  );
}

export function useRegister() {
  return useMutation({ mutationFn: register });
}

/* ---------------------------------- login ---------------------------------- */

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  /** seconds until the accessToken expires (server sends 900) */
  expiresIn: number;
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The server sets the httpOnly refresh cookie on this response.
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return (await response.json()) as AuthSession;
  }

  const data = await readJson(response);

  if (response.status === 400) {
    // Phone is not +7/7/8 followed by 10 digits, or a field is missing.
    throw new ApiError('Проверьте номер телефона и пароль', 400, data?.errors);
  }
  if (response.status === 401) {
    throw new ApiError('Неверный телефон или пароль', 401);
  }
  if (response.status === 403) {
    throw new ApiError(
      data?.detail ?? 'Аккаунт не подтверждён владельцем',
      403,
    );
  }
  throw new ApiError(
    data?.detail ?? `Не удалось войти (${response.status})`,
    response.status,
  );
}

/* --------------------------------- refresh --------------------------------- */

const REFRESH_LOCK = 'account-this:auth-refresh';

/**
 * Runs `task` under the cross-tab lock that guards the refresh cookie (Web Locks API).
 * Every request that rotates the refresh token (refresh, change-password) goes through it,
 * so two tabs never present the same token at the same time. Not re-entrant: do not call
 * anything that takes this lock again (e.g. `runRefresh`) from inside `task`.
 */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(REFRESH_LOCK, task);
  }
  return task();
}

/**
 * Silently restore / extend the session using the httpOnly refresh cookie
 * (POST /api/auth/refresh, no body). Returns null when there is no valid
 * session (401): the caller must show the login screen.
 */
export async function refresh(): Promise<AuthSession | null> {
  // The refresh token is rotated on every use, and the backend ends the whole
  // session if an already-used token is presented again. The cookie is shared
  // by all tabs, so refreshes must not run in parallel across tabs: serialize
  // them with the Web Locks API. A tab that waits for the lock then sends the
  // cookie the other tab has just received.
  return withRefreshLock(refreshOnce);
}

async function refreshOnce(): Promise<AuthSession | null> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (response.status === 401 || response.status === 403) return null;

  if (!response.ok) {
    throw new ApiError('Не удалось продлить сессию', response.status);
  }

  return (await response.json()) as AuthSession;
}

/* --------------------------------- logout ---------------------------------- */

export async function logout(): Promise<void> {
  // Always 204. Cookie is cleared by the server.
  // Use apiFetch so the access token is attached when still valid.
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

/* ----------------------------- change password ----------------------------- */

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

function postChangePassword(
  token: string | null,
  payload: ChangePasswordPayload,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // The server rotates the refresh token on success, so the request takes the same lock as
  // `refresh`: a refresh in another tab must not present the old cookie at the same moment.
  return withRefreshLock(() =>
    fetch('/api/auth/change-password', {
      method: 'POST',
      headers,
      // The new httpOnly refresh cookie is set on this response.
      credentials: 'include',
      body: JSON.stringify(payload),
    }),
  );
}

/**
 * POST /api/auth/change-password (any role).
 *  - 200 -> a new session ({ accessToken, expiresIn }) + new refresh cookie. The caller must
 *    store the new access token like after login (AuthProvider.changePassword does it).
 *    All other devices are signed out; this one stays.
 *  - 400 -> field errors: `currentPassword` (wrong current password), `newPassword` (empty or
 *    the same as the current one). A wrong password is 400, not 401, so it never triggers refresh.
 *  - 401 -> missing / expired JWT: refresh once and replay (same rules as apiFetch).
 *  - 403 -> account deactivated.
 */
export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<AuthSession> {
  const sentWith = readToken();
  let response = await postChangePassword(sentWith, payload);

  if (response.status === 401) {
    // Same as apiFetch: if the token changed meanwhile, just replay; otherwise refresh once.
    // Called outside the lock, because runRefresh takes it itself.
    const current = readToken();
    const retryToken =
      current && current !== sentWith ? current : await runRefresh();
    if (retryToken) response = await postChangePassword(retryToken, payload);
    if (response.status === 401) runSignOut();
  }

  if (response.ok) {
    const session = (await response.json()) as Partial<AuthSession> | null;
    if (!session || typeof session.accessToken !== 'string') {
      throw new ApiError('Сервер вернул некорректный ответ', response.status);
    }
    return {
      accessToken: session.accessToken,
      expiresIn: typeof session.expiresIn === 'number' ? session.expiresIn : 900,
    };
  }

  const data = await readJson(response);

  if (response.status === 400) {
    const errors = data?.errors;
    const message =
      errors?.currentPassword?.[0] ?? errors?.newPassword?.[0] ?? 'Проверьте поля формы';
    throw new ApiError(message, 400, errors);
  }
  if (response.status === 401) {
    throw new ApiError('Сессия завершена, войдите заново', 401);
  }
  if (response.status === 403) {
    throw new ApiError(data?.detail ?? 'Аккаунт деактивирован', 403);
  }
  throw new ApiError(
    data?.detail ?? `Не удалось изменить пароль (${response.status})`,
    response.status,
  );
}
