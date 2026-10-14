// src/api/http.ts
import { readToken, runRefresh, runSignOut } from './authBridge';

/**
 * Fetch wrapper for every API call except /api/auth/login, /register and
 * /refresh themselves (use plain `fetch` there to avoid recursion).
 *
 *  - attaches `Authorization: Bearer <token>` when a token is available;
 *  - always sends cookies, so the refresh cookie travels with the request;
 *  - on 401:
 *      1. if the token has changed since we sent the request (a timer, another
 *         request or another tab already refreshed), just replay with the
 *         current token — NO extra refresh;
 *      2. otherwise refresh once (deduplicated in-tab, serialized across tabs)
 *         and replay with the new token;
 *  - if the answer is still 401, the session is over: sign out locally so the
 *    router shows the login screen.
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

  const sentWith = readToken();
  let response = await send(sentWith);

  if (response.status !== 401) return response;

  const current = readToken();
  const retryToken =
    current && current !== sentWith ? current : await runRefresh();

  if (retryToken) {
    response = await send(retryToken);
  }

  if (response.status === 401) runSignOut();

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