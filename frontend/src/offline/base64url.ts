// base64url.ts — RFC 4648 §5 without padding: the only binary encoding of the AT1 protocol.
// Strictness matches the backend (QrPayloadParser.DecodeBase64Url).

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Non-empty, only A–Z a–z 0–9 - _ (no "="), and no impossible length (n % 4 == 1). */
export function isBase64Url(value: string): boolean {
  return value.length > 0 && BASE64URL_RE.test(value) && value.length % 4 !== 1;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on anything that is not valid base64url without padding. */
export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!isBase64Url(value)) throw new Error('not base64url without padding');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8Encode(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/** Strict: throws on invalid UTF-8 (the server rejects such a token/op too). */
export function utf8DecodeStrict(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

export function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(utf8Encode(text));
}
