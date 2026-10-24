import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAt1 } from '../at1';
import { closeDb } from '../db';
import { confirmOperation, countByStatus, listByStatus, listRecent } from '../journal';
import { getMeta, saveServerTime } from '../meta';
import { parseBadRecords, syncJournal, SyncError, type SendFn } from '../syncService';
import { forgeQr } from './helpers';

const ISSUER = 'issuer-1';
const OTHER = 'issuer-2';

/** n distinct valid QRs confirmed for `userId` (each worker signature differs by timestamp) */
async function fill(userId: string, n: number, from = 0) {
  for (let i = from; i < from + n; i++) {
    const qr = await forgeQr({ operation: { timestamp: 1790003600 + i } });
    const parsed = parseAt1(qr);
    if (!parsed.ok) throw new Error('bad fixture');
    await confirmOperation({ userId, payload: parsed.payload, scannedAt: 1790003610 + i });
  }
}

const allValid: SendFn = async (records) => ({
  kind: 'ok',
  results: records.map((_, i) => ({ logId: 100 + i, validationFlag: 'VALID' as const })),
});

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
});

describe('parseBadRecords', () => {
  it('reads "[n].qr" keys and ignores everything else', () => {
    expect(
      parseBadRecords({ '[3].qr': ['bad one'], '[0].qr': ['first'], '$': ['body'], '[2].scannedAt': ['x'] }),
    ).toEqual([
      { index: 0, message: 'first' },
      { index: 3, message: 'bad one' },
    ]);
    expect(parseBadRecords(undefined)).toEqual([]);
    expect(parseBadRecords({ '$[1].qr': ['x'] })).toEqual([]);
  });
});

describe('syncJournal', () => {
  it('nothing pending: no request', async () => {
    const send = vi.fn();
    expect(await syncJournal({ userId: ISSUER, send })).toEqual({ sent: 0, quarantined: 0, flagged: {} });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the records in scan order with scannedAt, stores logId and flag, remembers the time', async () => {
    await fill(ISSUER, 3);
    const send = vi.fn<SendFn>(async (records) => ({
      kind: 'ok',
      results: records.map((_, i) => ({ logId: 41 + i, validationFlag: i === 1 ? ('TIME_DRIFT' as const) : ('VALID' as const) })),
    }));
    await saveServerTime(1790100000, Date.now());
    const summary = await syncJournal({ userId: ISSUER, send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].map((r) => r.scannedAt)).toEqual([1790003610, 1790003611, 1790003612]);
    expect(summary).toEqual({ sent: 3, quarantined: 0, flagged: { TIME_DRIFT: 1 } });

    const sent = (await listRecent(ISSUER)).sort((a, b) => a.id! - b.id!);
    expect(sent.map((e) => [e.status, e.logId, e.validationFlag])).toEqual([
      ['sent', 41, 'VALID'],
      ['sent', 42, 'TIME_DRIFT'],
      ['sent', 43, 'VALID'],
    ]);
    expect((await getMeta('lastSyncAt'))?.[ISSUER]).toBeGreaterThanOrEqual(1790100000);
  });

  it("never touches another issuer's records", async () => {
    await fill(ISSUER, 1);
    await fill(OTHER, 2, 10);
    await syncJournal({ userId: ISSUER, send: allValid });
    expect(await countByStatus(ISSUER)).toEqual({ pending: 0, sent: 1, quarantined: 0 });
    expect(await countByStatus(OTHER)).toEqual({ pending: 2, sent: 0, quarantined: 0 });
  });

  it('splits a long queue into batches', async () => {
    await fill(ISSUER, 5);
    const send = vi.fn(allValid);
    const summary = await syncJournal({ userId: ISSUER, send, batchSize: 2 });
    expect(send.mock.calls.map((c) => c[0].length)).toEqual([2, 2, 1]);
    expect(summary.sent).toBe(5);
  });

  it('400 "[n].qr": the bad ones are set aside, the rest is sent again', async () => {
    await fill(ISSUER, 4);
    const ids = (await listByStatus(ISSUER, 'pending')).map((e) => e.id!);
    let call = 0;
    const send = vi.fn<SendFn>(async (records) => {
      call++;
      if (call === 1) return { kind: 'badFormat', bad: [{ index: 1, message: 'плохой формат' }, { index: 3, message: 'тоже' }] };
      return { kind: 'ok', results: records.map((_, i) => ({ logId: 7 + i, validationFlag: 'VALID' as const })) };
    });
    const summary = await syncJournal({ userId: ISSUER, send });

    expect(send.mock.calls[1][0]).toHaveLength(2); // the two good ones, same request again
    expect(summary).toMatchObject({ sent: 2, quarantined: 2 });
    const byId = new Map((await listRecent(ISSUER)).map((e) => [e.id, e]));
    expect([ids[0], ids[2]].map((id) => byId.get(id)?.status)).toEqual(['sent', 'sent']);
    expect(byId.get(ids[1])).toMatchObject({ status: 'quarantined', quarantineReason: 'плохой формат' });
    expect(byId.get(ids[3])?.status).toBe('quarantined');
    // quarantined records are not sent again on the next run
    const again = vi.fn(allValid);
    await syncJournal({ userId: ISSUER, send: again });
    expect(again).not.toHaveBeenCalled();
  });

  it('a 400 that points at no record changes nothing', async () => {
    await fill(ISSUER, 2);
    await expect(
      syncJournal({ userId: ISSUER, send: async () => ({ kind: 'badFormat', bad: [] }) }),
    ).rejects.toBeInstanceOf(SyncError);
    expect((await countByStatus(ISSUER)).pending).toBe(2);
  });

  it('network error: everything stays pending; the next run sends it all (idempotent resend)', async () => {
    await fill(ISSUER, 2);
    await expect(
      syncJournal({
        userId: ISSUER,
        send: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    ).rejects.toThrow('Failed to fetch');
    expect((await countByStatus(ISSUER)).pending).toBe(2);
    expect((await syncJournal({ userId: ISSUER, send: allValid })).sent).toBe(2);
  });

  it('failure in the second batch keeps the first one sent', async () => {
    await fill(ISSUER, 3);
    let call = 0;
    const send: SendFn = async (records) => {
      if (++call === 2) throw new TypeError('offline');
      return allValid(records);
    };
    await expect(syncJournal({ userId: ISSUER, send, batchSize: 2 })).rejects.toThrow('offline');
    expect(await countByStatus(ISSUER)).toEqual({ pending: 1, sent: 2, quarantined: 0 });
  });

  it('wrong number of results is refused without marking anything', async () => {
    await fill(ISSUER, 2);
    await expect(
      syncJournal({ userId: ISSUER, send: async () => ({ kind: 'ok', results: [{ logId: 1, validationFlag: 'VALID' }] }) }),
    ).rejects.toBeInstanceOf(SyncError);
    expect((await countByStatus(ISSUER)).pending).toBe(2);
  });
});
