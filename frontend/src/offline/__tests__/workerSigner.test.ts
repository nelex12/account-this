import { describe, expect, it } from 'vitest';
import { parseAt1 } from '../at1';
import { CertificateError, createOperationQr, createStoredCertificate, isCertificateValidAt } from '../workerSigner';
import { verifyWorkerQr } from '../verifyQr';
import { VECTOR } from './fixtures';
import { SERVER_PUBLIC_KEY, TOOL_ID, WORKER_ID } from './helpers';

const response = {
  token: VECTOR.token,
  serverSignature: VECTOR.serverSignature,
  temporaryPrivateKey: VECTOR.workerSeed,
  serverTime: 1790003000,
};
const operation = { action: 'TAKE', toolCondition: 'Good', toolId: TOOL_ID, toolName: 'Дрель Bosch' } as const;

describe('worker side', () => {
  it('builds exactly the golden QR (Ed25519 is deterministic)', async () => {
    const cert = await createStoredCertificate(WORKER_ID, response);
    const { qr, workerSignature } = await createOperationQr(cert, operation, 1790003600);
    expect(qr).toBe(VECTOR.qr);
    expect(workerSignature).toBe(VECTOR.workerSignature);
  });

  it('the Issuer accepts what the Worker produces', async () => {
    const cert = await createStoredCertificate(WORKER_ID, response);
    const { qr } = await createOperationQr(cert, { ...operation, action: 'GIVE', toolCondition: 'Damaged' }, 1790003700);
    const r = await verifyWorkerQr(qr, { serverPublicKey: SERVER_PUBLIC_KEY, serverNowSec: 1790003710, isDuplicate: () => false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.operation).toMatchObject({ action: 'GIVE', toolCondition: 'Damaged', timestamp: 1790003700 });
  });

  it('two operations are two different QRs (different timestamp/tool -> different signature)', async () => {
    const cert = await createStoredCertificate(WORKER_ID, response);
    const a = await createOperationQr(cert, operation, 1790003600);
    const b = await createOperationQr(cert, { ...operation, toolId: '27c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35' }, 1790003600);
    expect(a.workerSignature).not.toBe(b.workerSignature);
    expect(parseAt1(a.qr).ok && parseAt1(b.qr).ok).toBe(true);
  });

  it('keeps token and serverSignature exactly as received', async () => {
    const cert = await createStoredCertificate(WORKER_ID, response);
    expect(cert.token).toBe(VECTOR.token);
    expect(cert.serverSignature).toBe(VECTOR.serverSignature);
    expect([cert.issuedAt, cert.expiresAt]).toEqual([1790000000, 1790043200]);
  });

  it('refuses to sign outside the certificate lifetime', async () => {
    const cert = await createStoredCertificate(WORKER_ID, response);
    await expect(createOperationQr(cert, operation, 1790043201)).rejects.toBeInstanceOf(CertificateError);
    await expect(createOperationQr(cert, operation, 1789999999)).rejects.toBeInstanceOf(CertificateError);
    expect(isCertificateValidAt(cert, 1790043200)).toBe(true);
    expect(isCertificateValidAt(cert, 1790043201)).toBe(false);
  });

  it('refuses a certificate of another worker, a broken token and a mismatched key', async () => {
    await expect(createStoredCertificate('00000000-0000-4000-8000-000000000001', response)).rejects.toBeInstanceOf(CertificateError);
    await expect(createStoredCertificate(WORKER_ID, { ...response, token: 'garbage' })).rejects.toBeInstanceOf(CertificateError);
    await expect(
      createStoredCertificate(WORKER_ID, { ...response, temporaryPrivateKey: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8' }),
    ).rejects.toBeInstanceOf(CertificateError);
  });
});
