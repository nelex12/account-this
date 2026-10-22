import { afterEach, describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode } from '../base64url';
import { operationSignedData, tokenSignedData } from '../at1';
import { importSigningKey, setEd25519Mode, sign, verify, type SigningKey } from '../ed25519';
import { BACKEND_VECTORS, VECTOR } from './fixtures';

const serverPublic = base64UrlDecode(BACKEND_VECTORS.serverPublicKey);
const workerPublic = base64UrlDecode(VECTOR.workerPublicKey);
const workerSeed = base64UrlDecode(VECTOR.workerSeed);

afterEach(() => setEd25519Mode('auto'));

// Every test runs on BOTH backends: native WebCrypto and the @noble/curves fallback.
describe.each(['auto', 'noble'] as const)('Ed25519 (%s backend)', (mode) => {
  const use = () => setEd25519Mode(mode);

  it('uses the expected key type', async () => {
    use();
    const key = await importSigningKey(workerSeed, workerPublic);
    expect(key.kind).toBe(mode === 'auto' ? 'webcrypto' : 'seed');
  });

  it('verifies the backend test signatures (RFC 8032 vector 1)', async () => {
    use();
    expect(await verify(serverPublic, '', base64UrlDecode(BACKEND_VECTORS.signatureOfEmptyMessage))).toBe(true);
    expect(await verify(serverPublic, 'AT1-TOKEN.abc', base64UrlDecode(BACKEND_VECTORS.signatureOfTokenAbc))).toBe(true);
  });

  it('signs the same bytes as the reference implementation', async () => {
    use();
    const server = await importSigningKey(base64UrlDecode(BACKEND_VECTORS.serverSeed), serverPublic);
    expect(base64UrlEncode(await sign(server, 'AT1-TOKEN.abc'))).toBe(BACKEND_VECTORS.signatureOfTokenAbc);
    expect(base64UrlEncode(await sign(server, tokenSignedData(VECTOR.token)))).toBe(VECTOR.serverSignature);

    const worker = await importSigningKey(workerSeed, workerPublic);
    const message = operationSignedData(VECTOR.token, VECTOR.serverSignature, VECTOR.op);
    expect(base64UrlEncode(await sign(worker, message))).toBe(VECTOR.workerSignature);
  });

  it('rejects a changed message, signature or key', async () => {
    use();
    const sig = base64UrlDecode(BACKEND_VECTORS.signatureOfTokenAbc);
    expect(await verify(serverPublic, 'AT1-TOKEN.abd', sig)).toBe(false);
    const flipped = new Uint8Array(sig);
    flipped[10] ^= 1;
    expect(await verify(serverPublic, 'AT1-TOKEN.abc', flipped)).toBe(false);
    expect(await verify(workerPublic, 'AT1-TOKEN.abc', sig)).toBe(false);
  });

  it('never throws on malformed input', async () => {
    use();
    expect(await verify(new Uint8Array(5), 'x', new Uint8Array(64))).toBe(false);
    expect(await verify(serverPublic, 'x', new Uint8Array(10))).toBe(false);
  });

  it('refuses a private key that does not belong to the public key', async () => {
    use();
    await expect(importSigningKey(workerSeed, serverPublic)).rejects.toThrow();
    await expect(importSigningKey(new Uint8Array(31), workerPublic)).rejects.toThrow();
  });
});

describe('native key', () => {
  it('is not extractable: the seed cannot be read back', async () => {
    const key: SigningKey = await importSigningKey(workerSeed, workerPublic);
    if (key.kind !== 'webcrypto') return; // runtime without WebCrypto Ed25519
    expect(key.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', key.key)).rejects.toThrow();
  });
});
