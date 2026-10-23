import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../../entities/toolsModel';
import { closeDb } from '../db';
import { checkWorkerQr } from '../issuerScan';
import { confirmOperation } from '../journal';
import { getTool, replaceRegistry } from '../registry';
import { saveServerKey } from '../meta';
import { readIssuerDataStatus, refreshIssuerData } from '../issuerDataService';
import { forgeQr, TOOL_ID, withPart } from './helpers';
import { VECTOR } from './fixtures';

const ISSUER = 'issuer-1';
const SCAN_SEC = 1790003610; // 10 s after the operation in the forged QR (timestamp 1790003600)

const tool = (over: Partial<Tool> = {}): Tool =>
  ({ id: TOOL_ID, name: 'Дрель Bosch', condition: 'Good', ...over }) as Tool;

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SCAN_SEC * 1000);
});
afterEach(() => vi.useRealTimers());

const withKey = () => saveServerKey({ serverPublicKey: VECTOR.serverPublicKey, serverTime: SCAN_SEC });

describe('checkWorkerQr', () => {
  it('not an AT1 string: foreign', async () => {
    expect(await checkWorkerQr('https://example.com', ISSUER)).toEqual({ kind: 'foreign' });
  });

  it('no server key saved: noKey', async () => {
    expect((await checkWorkerQr(await forgeQr(), ISSUER)).kind).toBe('noKey');
  });

  it('valid QR, tool matches the registry: accepted without warnings', async () => {
    await withKey();
    await replaceRegistry(ISSUER, [tool()]);
    const r = await checkWorkerQr(await forgeQr(), ISSUER);
    expect(r).toMatchObject({ kind: 'accepted', scannedAt: SCAN_SEC, warnings: [] });
  });

  it('condition differs and unknown tool become warnings, not errors', async () => {
    await withKey();
    await replaceRegistry(ISSUER, [tool({ condition: 'Broken' })]);
    const mismatch = await checkWorkerQr(await forgeQr(), ISSUER);
    expect(mismatch).toMatchObject({ kind: 'accepted', warnings: [{ kind: 'CONDITION_MISMATCH' }] });

    await replaceRegistry(ISSUER, []);
    const unknown = await checkWorkerQr(await forgeQr(), ISSUER);
    expect(unknown).toMatchObject({ kind: 'accepted', warnings: [{ kind: 'UNKNOWN_TOOL' }] });
  });

  it('tampered, expired and out-of-time QRs are rejected', async () => {
    await withKey();
    const qr = await forgeQr();
    expect(await checkWorkerQr(withPart(qr, 4, 'A'.repeat(86)), ISSUER)).toMatchObject({
      kind: 'rejected',
      reason: 'INVALID_WORKER_SIG',
    });
    expect(await checkWorkerQr(await forgeQr({ expiresAt: 1790003000 }), ISSUER)).toMatchObject({
      kind: 'rejected',
      reason: 'EXPIRED_TOKEN',
    });
    expect(await checkWorkerQr(await forgeQr({ operation: { timestamp: 1790003000 } }), ISSUER)).toMatchObject({
      kind: 'rejected',
      reason: 'TIME_DRIFT',
    });
    expect(await checkWorkerQr(await forgeQr({ serverSeed: VECTOR.workerSeed }), ISSUER)).toMatchObject({
      kind: 'rejected',
      reason: 'INVALID_SERVER_SIG',
    });
  });

  it('after confirming, the same QR is a duplicate; another issuer is unaffected', async () => {
    await withKey();
    await replaceRegistry(ISSUER, [tool()]);
    const qr = await forgeQr();
    const first = await checkWorkerQr(qr, ISSUER);
    if (first.kind !== 'accepted') throw new Error('expected accepted');
    await confirmOperation({ userId: ISSUER, payload: first.payload, scannedAt: first.scannedAt });

    expect(await checkWorkerQr(qr, ISSUER)).toMatchObject({ kind: 'rejected', reason: 'DUPLICATE' });
    expect((await checkWorkerQr(qr, 'issuer-2')).kind).toBe('accepted');
    // the local registry followed the operation: TAKE moved the tool to the worker
    expect((await getTool(TOOL_ID))?.localOpAt).toBeDefined();
  });
});

describe('refreshIssuerData', () => {
  const serverKey = async () => ({ serverPublicKey: VECTOR.serverPublicKey, serverTime: SCAN_SEC });

  it('downloads both and reports the status', async () => {
    const r = await refreshIssuerData({ issuerId: ISSUER, fetchServerKey: serverKey, fetchTools: async () => [tool()] });
    expect(r).toEqual({ serverKey: 'ok', registry: 'ok' });
    expect(await readIssuerDataStatus(ISSUER)).toMatchObject({ hasServerKey: true });
    expect((await readIssuerDataStatus(ISSUER)).registryFetchedAt).not.toBeNull();
    expect((await readIssuerDataStatus('someone-else')).registryFetchedAt).toBeNull();
  });

  it('offline: nothing is requested', async () => {
    const fetchServerKey = vi.fn();
    const fetchTools = vi.fn();
    const r = await refreshIssuerData({ issuerId: ISSUER, fetchServerKey, fetchTools, online: false });
    expect(r).toEqual({ serverKey: 'skipped', registry: 'skipped' });
    expect(fetchServerKey).not.toHaveBeenCalled();
    expect(fetchTools).not.toHaveBeenCalled();
  });

  it('one failure does not stop the other, and a failed download keeps the old registry', async () => {
    await refreshIssuerData({ issuerId: ISSUER, fetchServerKey: serverKey, fetchTools: async () => [tool()] });
    const r = await refreshIssuerData({
      issuerId: ISSUER,
      fetchServerKey: async () => {
        throw new Error('down');
      },
      fetchTools: async () => {
        throw new Error('down');
      },
    });
    expect(r).toEqual({ serverKey: 'failed', registry: 'failed' });
    expect(await getTool(TOOL_ID)).toBeDefined();
    expect((await readIssuerDataStatus(ISSUER)).hasServerKey).toBe(true);
  });
});
