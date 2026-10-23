// src/api/serverKey.ts — GET /api/auth/server-key (no authorization: the key is public).
// { serverPublicKey (Ed25519, base64url, 32 bytes), serverTime (Unix seconds) }.
// The Issuer verifies the Workers' certificates offline with this key (src/offline/verifyQr.ts).
import { ApiError } from './auth';

export interface ServerKeyResponse {
  serverPublicKey: string;
  serverTime: number;
}

export async function fetchServerKey(): Promise<ServerKeyResponse> {
  const response = await fetch('/api/auth/server-key');
  if (!response.ok) throw new ApiError(`Не удалось получить ключ сервера (${response.status})`, response.status);
  return (await response.json()) as ServerKeyResponse;
}
