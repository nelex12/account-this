import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb } from '../db';
import { getCertificate, saveCertificate } from '../certs';
import { CertificateFetchError, RENEW_WHEN_LEFT_SEC, ensureCertificate } from '../certificateService';
import { getServerNowSec, isClockSynced, saveServerTime } from '../meta';
import { qrSecondsLeft, QR_SHOWN_FOR_SEC } from '../qrValidity';
import { createStoredCertificate, type WorkerCertificateResponse } from '../workerSigner';
import { VECTOR } from './fixtures';
import { WORKER_ID } from './helpers';

// The golden certificate lives from 1790000000 to 1790043200 (12 h).
const ISSUED = 1790000000;
const EXPIRES = 1790043200;
const at = (sec: number) => sec * 1000;

const response = (over: Partial<WorkerCertificateResponse> = {}): WorkerCertificateResponse => ({
  token: VECTOR.token,
  serverSignature: VECTOR.serverSignature,
  temporaryPrivateKey: VECTOR.workerSeed,
  serverTime: ISSUED + 100,
  ...over,
});

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
});

async function storeGoldenCertificate() {
  await saveCertificate(await createStoredCertificate(WORKER_ID, response(), at(ISSUED)));
}

describe('ensureCertificate', () => {
  it('first start, online: fetches, stores the certificate and the clock offset', async () => {
    const fetchCertificate = vi.fn().mockResolvedValue(response({ serverTime: ISSUED + 100 }));
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, nowMs: at(ISSUED + 90) }); // phone is 10 s slow
    expect(r).toMatchObject({ status: 'ready', refreshed: true });
    expect(fetchCertificate).toHaveBeenCalledTimes(1);
    expect((await getCertificate(WORKER_ID))?.token).toBe(VECTOR.token);
    expect(await isClockSynced()).toBe(true);
    expect(await getServerNowSec(at(ISSUED + 90))).toBe(ISSUED + 100);
  });

  it('plenty of time left: no request at all', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn();
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, nowMs: at(ISSUED + 1000) });
    expect(r).toMatchObject({ status: 'ready', refreshed: false });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it('less than the renewal margin left and online: asks for a new one', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn().mockResolvedValue(response());
    const now = EXPIRES - RENEW_WHEN_LEFT_SEC + 1;
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, nowMs: at(now) });
    expect(r).toMatchObject({ status: 'ready', refreshed: true });
    expect(fetchCertificate).toHaveBeenCalledTimes(1);
  });

  it('exactly at the margin the old one is still kept', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn();
    await ensureCertificate({ userId: WORKER_ID, fetchCertificate, nowMs: at(EXPIRES - RENEW_WHEN_LEFT_SEC) });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it('near expiry but offline: the old certificate keeps working', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn();
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, online: false, nowMs: at(EXPIRES - 60) });
    expect(r).toMatchObject({ status: 'ready', refreshed: false });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it('offline with nothing stored: "missing"', async () => {
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate: vi.fn(), online: false, nowMs: at(ISSUED) });
    expect(r).toEqual({ status: 'missing' });
  });

  it('offline and the stored certificate has expired: "missing"', async () => {
    await storeGoldenCertificate();
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate: vi.fn(), online: false, nowMs: at(EXPIRES + 1) });
    expect(r).toEqual({ status: 'missing' });
  });

  it('the stored clock offset is used for validity (a phone that is 1 h fast)', async () => {
    await storeGoldenCertificate();
    // local clock says EXPIRES+1800, but the server is 1 h behind it -> still inside the lifetime
    await saveServerTime(EXPIRES - 1800, at(EXPIRES + 1800));
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate: vi.fn(), online: false, nowMs: at(EXPIRES + 1800) });
    expect(r).toMatchObject({ status: 'ready' });
  });

  it('network error: keeps a usable certificate, otherwise "missing"', async () => {
    const fail = vi.fn().mockRejectedValue(new CertificateFetchError('network', 'offline'));
    expect(await ensureCertificate({ userId: WORKER_ID, fetchCertificate: fail, nowMs: at(ISSUED + 10) })).toEqual({ status: 'missing' });

    await storeGoldenCertificate();
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate: fail, nowMs: at(EXPIRES - 100) });
    expect(r).toMatchObject({ status: 'ready', refreshed: false });
  });

  it('server error: keeps a usable certificate, otherwise reports the error', async () => {
    const fail = vi.fn().mockRejectedValue(new CertificateFetchError('server', 'Не удалось получить сертификат (500)'));
    expect(await ensureCertificate({ userId: WORKER_ID, fetchCertificate: fail, nowMs: at(ISSUED + 10) })).toEqual({
      status: 'error',
      message: 'Не удалось получить сертификат (500)',
    });
    await storeGoldenCertificate();
    expect(await ensureCertificate({ userId: WORKER_ID, fetchCertificate: fail, nowMs: at(EXPIRES - 100) })).toMatchObject({ status: 'ready' });
  });

  it('403 (dismissed): reports it AND deletes the stored certificate', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn().mockRejectedValue(new CertificateFetchError('forbidden', 'Сотрудник уволен, сертификат не выдаётся'));
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, force: true, nowMs: at(ISSUED + 10) });
    expect(r).toEqual({ status: 'forbidden', message: 'Сотрудник уволен, сертификат не выдаётся' });
    expect(await getCertificate(WORKER_ID)).toBeUndefined();
  });

  it('a certificate for another worker is refused and not stored', async () => {
    const fetchCertificate = vi.fn().mockResolvedValue(response());
    const r = await ensureCertificate({ userId: '00000000-0000-4000-8000-000000000001', fetchCertificate, nowMs: at(ISSUED + 10) });
    expect(r.status).toBe('error');
    expect(await getCertificate('00000000-0000-4000-8000-000000000001')).toBeUndefined();
  });

  it('force = new certificate even if the old one is fine', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn().mockResolvedValue(response());
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, force: true, nowMs: at(ISSUED + 10) });
    expect(r).toMatchObject({ status: 'ready', refreshed: true });
    expect(fetchCertificate).toHaveBeenCalledTimes(1);
  });

  it('force while offline does not try the network', async () => {
    await storeGoldenCertificate();
    const fetchCertificate = vi.fn();
    const r = await ensureCertificate({ userId: WORKER_ID, fetchCertificate, force: true, online: false, nowMs: at(ISSUED + 10) });
    expect(r).toMatchObject({ status: 'ready', refreshed: false });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });
});

describe('qrSecondsLeft', () => {
  it('counts down from the display window to zero', () => {
    expect(qrSecondsLeft(1000, 1000)).toBe(QR_SHOWN_FOR_SEC);
    expect(qrSecondsLeft(1000, 1000 + QR_SHOWN_FOR_SEC)).toBe(0);
    expect(qrSecondsLeft(1000, 1000 + QR_SHOWN_FOR_SEC + 5)).toBeLessThan(0);
  });

  it('always ends before the Issuer\'s 60 s limit', () => {
    expect(QR_SHOWN_FOR_SEC).toBeLessThan(60);
  });
});
