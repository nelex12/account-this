import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, changePassword } from '../auth';
import { registerAuthBridge } from '../authBridge';

const payload = { currentPassword: 'old-pass', newPassword: 'new-pass' };

/** Authorization header of the n-th fetch call. */
function authHeader(mock: { mock: { calls: Parameters<typeof fetch>[] } }, call: number): string {
  const headers = (mock.mock.calls[call][1] ?? {}).headers as Record<string, string>;
  return headers.Authorization;
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

describe('changePassword', () => {
  let token: string | null;
  const refresh = vi.fn<() => Promise<string | null>>();
  const signOut = vi.fn();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    token = 'access-1';
    refresh.mockReset();
    signOut.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    registerAuthBridge({ getToken: () => token, refresh, signOut });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts both passwords with the bearer token and returns the new session', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'access-2', expiresIn: 900 }));

    await expect(changePassword(payload)).resolves.toEqual({
      accessToken: 'access-2',
      expiresIn: 900,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/change-password');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(authHeader(fetchMock, 0)).toBe('Bearer access-1');
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it('400 wrong current password: field error, no refresh, no sign-out', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { errors: { currentPassword: ['Неверный текущий пароль'] } }),
    );

    const error = await changePassword(payload).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe('Неверный текущий пароль');
    expect((error as ApiError).fieldErrors?.currentPassword).toEqual(['Неверный текущий пароль']);
    expect(refresh).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('400 new password rejected: error under newPassword', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { errors: { newPassword: ['Новый пароль совпадает с текущим'] } }),
    );

    const error = (await changePassword(payload).catch((e: unknown) => e)) as ApiError;

    expect(error.fieldErrors?.newPassword).toEqual(['Новый пароль совпадает с текущим']);
  });

  it('401 expired JWT: refreshes once and replays with the new token', async () => {
    refresh.mockResolvedValueOnce('access-refreshed');
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { accessToken: 'access-2', expiresIn: 900 }));

    await expect(changePassword(payload)).resolves.toMatchObject({ accessToken: 'access-2' });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authHeader(fetchMock, 1)).toBe('Bearer access-refreshed');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('401 and the token was already replaced meanwhile: replays without a refresh', async () => {
    fetchMock.mockImplementationOnce(async () => {
      token = 'access-from-other-tab';
      return json(401);
    });
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'access-2', expiresIn: 900 }));

    await changePassword(payload);

    expect(refresh).not.toHaveBeenCalled();
    expect(authHeader(fetchMock, 1)).toBe('Bearer access-from-other-tab');
  });

  it('401 after the refresh as well: signs out locally', async () => {
    refresh.mockResolvedValueOnce('access-refreshed');
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));

    const error = (await changePassword(payload).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('403 deactivated account: message from the server, no refresh', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { detail: 'Сотрудник уволен' }));

    const error = (await changePassword(payload).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(403);
    expect(error.message).toBe('Сотрудник уволен');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 without a body falls back to a default message', async () => {
    fetchMock.mockResolvedValueOnce(json(403));

    const error = (await changePassword(payload).catch((e: unknown) => e)) as ApiError;

    expect(error.message).toBe('Аккаунт деактивирован');
  });
});
