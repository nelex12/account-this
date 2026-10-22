// ed25519.ts — Ed25519 (RFC 8032) sign/verify for the AT1 protocol.
//
// Primary backend: WebCrypto (native, the worker's private key can be stored as a
// NON-EXTRACTABLE CryptoKey in IndexedDB). Where the browser has no Ed25519 in WebCrypto
// (Chrome < 137, Safari < 17, Firefox < 129) the code falls back to @noble/curves, loaded
// lazily so it costs nothing on modern browsers. Ed25519 is deterministic: both backends
// give byte-identical signatures (covered by the tests).
import { base64UrlEncode, utf8Encode } from './base64url';

export type SigningKey =
  /** Non-extractable: the seed cannot be read back out of the browser. */
  | { kind: 'webcrypto'; key: CryptoKey }
  /** Fallback only: the 32-byte seed itself has to be kept. */
  | { kind: 'seed'; seed: Uint8Array };

export type Ed25519Mode = 'auto' | 'noble';

let mode: Ed25519Mode = 'auto';
let webCryptoSupport: Promise<boolean> | null = null;

/** For tests: force the fallback (or go back to auto-detection). */
export function setEd25519Mode(next: Ed25519Mode): void {
  mode = next;
}

/** RFC 8032 test vector 1: proves that the browser really implements Ed25519 correctly. */
const PROBE_PUBLIC_KEY = '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo';
const PROBE_SIGNATURE_OF_EMPTY =
  '5VZDAMNgrHKQhuLMgG6CioSHfx645dl02HPgZSJJAVVfuIIVkKM7rMYeOXAc-bRr0lv18FlbviRlUUFDjnoQCw';

async function probeWebCrypto(): Promise<boolean> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;
    const { base64UrlDecode } = await import('./base64url');
    const key = await subtle.importKey(
      'raw',
      base64UrlDecode(PROBE_PUBLIC_KEY),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await subtle.verify(
      { name: 'Ed25519' },
      key,
      base64UrlDecode(PROBE_SIGNATURE_OF_EMPTY),
      new Uint8Array(0),
    );
  } catch {
    return false;
  }
}

async function hasWebCrypto(): Promise<boolean> {
  if (mode === 'noble') return false;
  webCryptoSupport ??= probeWebCrypto();
  return webCryptoSupport;
}

async function noble() {
  return (await import('@noble/curves/ed25519.js')).ed25519;
}

/**
 * Builds a signing key from the server-issued seed. `publicKey` (from the token) is used
 * to detect a mismatched pair right away: a key that cannot sign for its own certificate
 * is useless, better to fail now than at the Issuer's desk.
 */
export async function importSigningKey(seed: Uint8Array, publicKey: Uint8Array): Promise<SigningKey> {
  if (seed.length !== 32) throw new Error('private key must be a 32-byte seed');
  if (publicKey.length !== 32) throw new Error('public key must be 32 bytes');

  let key: SigningKey;
  if (await hasWebCrypto()) {
    const jwk: JsonWebKey = {
      kty: 'OKP',
      crv: 'Ed25519',
      d: base64UrlEncode(seed),
      x: base64UrlEncode(publicKey),
    };
    key = {
      kind: 'webcrypto',
      key: await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']),
    };
  } else {
    key = { kind: 'seed', seed: new Uint8Array(seed) };
  }

  const probe = 'AT1-KEY-CHECK';
  if (!(await verify(publicKey, probe, await sign(key, probe)))) {
    throw new Error('private key does not match the public key');
  }
  return key;
}

/** Signs the UTF-8 bytes of `message` (AT1 signs ASCII strings). Returns 64 bytes. */
export async function sign(key: SigningKey, message: string): Promise<Uint8Array> {
  const data = utf8Encode(message);
  if (key.kind === 'webcrypto') {
    return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key.key, data));
  }
  return (await noble()).sign(data, key.seed);
}

/**
 * RFC 8032 verification. Never throws: any failure means "not valid".
 * Public keys are never attacker-chosen here: the server key is fixed by the deployment and the
 * worker key arrives inside a token the server signed, so degenerate (small-order) keys that some
 * implementations accept cannot be used to forge anything.
 */
export async function verify(publicKey: Uint8Array, message: string, signature: Uint8Array): Promise<boolean> {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  const data = utf8Encode(message);
  try {
    if (await hasWebCrypto()) {
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(publicKey),
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
      return await crypto.subtle.verify({ name: 'Ed25519' }, key, new Uint8Array(signature), data);
    }
    return (await noble()).verify(signature, data, publicKey, { zip215: false });
  } catch {
    return false;
  }
}
