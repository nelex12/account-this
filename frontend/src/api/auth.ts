// src/api/auth.ts
import { useMutation } from '@tanstack/react-query';
import type { Role } from '../entities/authModel';
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

/**
 * Silently restore / extend the session using the httpOnly refresh cookie.
 * Returns null when there is no valid session (401/403).
 *
 * Adjust the path if your backend uses a different endpoint name
 * (e.g. /api/auth/refresh-token).
 */
export async function refresh(): Promise<AuthSession | null> {
  // The refresh token is rotated on every use, and the backend ends the whole
  // session if an already-used token is presented again. The cookie is shared
  // by all tabs, so refreshes must not run in parallel across tabs: serialize
  // them with the Web Locks API. A tab that waits for the lock then sends the
  // cookie the other tab has just received.
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(REFRESH_LOCK, refreshOnce);
  }
  return refreshOnce();
}

const REFRESH_LOCK = 'account-this:auth-refresh';

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