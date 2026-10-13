// src/api/http.ts
import { readToken, runRefresh } from './authBridge';

/**
 * Fetch wrapper that:
 *  - attaches `Authorization: Bearer <token>` when a token is available,
 *  - always sends cookies (`credentials: 'include'`) so the refresh cookie
 *    travels with the request,
 *  - on 401, tries to refresh once and replays the request with the new token.
 *
 * Do NOT use this for /api/auth/login or /api/auth/refresh themselves —
 * use plain `fetch` there to avoid recursion.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: 'include' });
  };

  let response = await send(readToken());

  if (response.status === 401) {
    const nextToken = await runRefresh();
    if (nextToken) {
      response = await send(nextToken);
    }
  }

  return response;
}

/**
 * Same as apiFetch but parses JSON and throws on non-2xx.
 */
export async function apiJson<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}