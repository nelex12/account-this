import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tool } from '../../entities/toolsModel';
import { parseAt1 } from '../at1';
import { closeDb, DB_NAME, getDb } from '../db';
import { deleteCertificate, getCertificate, getValidCertificate, saveCertificate } from '../certs';
import {
  DuplicateQrError,
  confirmOperation,
  countByStatus,
  hasWorkerSignature,
  listByStatus,
  listRecent,
  markSent,
  quarantine,
} from '../journal';
import {
  deleteMeta,
  getMeta,
  getServerNowSec,
  isClockSynced,
  loadServerPublicKey,
  saveServerKey,
  saveServerTime,
  setMeta,
} from '../meta';
import { listOwnOperations, recordOwnOperation, toolsOnHand } from '../operations';
import { clearRegistry, getTool, listTools, replaceRegistry } from '../registry';
import { createStoredCertificate } from '../workerSigner';
import { VECTOR } from './fixtures';
import { TOOL_ID, WORKER_ID, forgeQr } from './helpers';

const ISSUER = 'issuer-1';
const OTHER_ISSUER = 'issuer-2';

const tool = (over: Partial<Tool> = {}): Tool => ({
  id: TOOL_ID,
  name: 'Дрель Bosch',
  condition: 'Good',
  comment: null,
  isActive: true,
  holderId: null,
  holderName: null,
  heldSince: null,
  ...over,
});

async function payloadOf(qr: string) {
  const r = parseAt1(qr);
  if (!r.ok) throw new Error(r.error);
  return r.payload;
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory(); // a fresh empty database for every test
});

describe('schema', () => {
  it('creates all stores and the unique signature index', async () => {
    const db = await getDb();
    expect(db.name).toBe(DB_NAME);
    expect([...db.objectStoreNames].sort()).toEqual(['certs', 'journal', 'meta', 'operations', 'tools']);
    const tx = db.transaction('journal');
    expect(tx.store.index('by-user-signature').unique).toBe(true);
  });
});

describe('meta: server key, clock, identity', () => {
  it('saves the server key together with the clock offset', async () => {
    expect(await loadServerPublicKey()).toBeNull();
    expect(await isClockSynced()).toBe(false);
    await saveServerKey({ serverPublicKey: VECTOR.serverPublicKey, serverTime: 1790000000 });
    expect(await loadServerPublicKey()).toHaveLength(32);
    expect(await isClockSynced()).toBe(true);
  });

  it('rejects a server key of the wrong size', async () => {
    await expect(saveServerKey({ serverPublicKey: 'AAAA', serverTime: 1 })).rejects.toThrow();
    expect(await loadServerPublicKey()).toBeNull();
  });

  it('server time offline = saved offset + local time', async () => {
    await saveServerTime(1_790_000_300, 1_790_000_000_000); // the phone is 300 s behind
    expect(await getServerNowSec(1_790_000_000_000 + 3_600_000)).toBe(1_790_003_900);
  });

  it('keeps the offline identity and per-issuer last sync', async () => {
    await setMeta('identity', { userId: ISSUER, role: 'Issuer', fullName: 'Завхоз', savedAt: 1 });
    await setMeta('lastSyncAt', { [ISSUER]: 100 });
    expect((await getMeta('identity'))?.role).toBe('Issuer');
    expect((await getMeta('lastSyncAt'))?.[ISSUER]).toBe(100);
    await deleteMeta('identity');
    expect(await getMeta('identity')).toBeUndefined();
  });
});

describe('certs', () => {
  it('stores the certificate with a usable signing key and finds it by validity', async () => {
    const cert = await createStoredCertificate(WORKER_ID, {
      token: VECTOR.token,
      serverSignature: VECTOR.serverSignature,
      temporaryPrivateKey: VECTOR.workerSeed,
      serverTime: 1790003000,
    });
    await saveCertificate(cert);

    const loaded = await getCertificate(WORKER_ID);
    expect(loaded?.token).toBe(VECTOR.token);
    expect(loaded?.signingKey.kind).toBe(cert.signingKey.kind);

    expect(await getValidCertificate(WORKER_ID, 1790003600)).toBeDefined();
    expect(await getValidCertificate(WORKER_ID, 1790043201)).toBeUndefined(); // expired
    expect(await getValidCertificate('someone-else', 1790003600)).toBeUndefined();

    await deleteCertificate(WORKER_ID);
    expect(await getCertificate(WORKER_ID)).toBeUndefined();
  });

  it('a certificate read back from IndexedDB still signs (non-extractable key survives storage)', async () => {
    const cert = await createStoredCertificate(WORKER_ID, {
      token: VECTOR.token,
      serverSignature: VECTOR.serverSignature,
      temporaryPrivateKey: VECTOR.workerSeed,
      serverTime: 1790003000,
    });
    await saveCertificate(cert);
    const loaded = (await getCertificate(WORKER_ID))!;
    const { createOperationQr } = await import('../workerSigner');
    const { qr } = await createOperationQr(
      loaded,
      { action: 'TAKE', toolCondition: 'Good', toolId: TOOL_ID, toolName: 'Дрель Bosch' },
      1790003600,
    );
    expect(qr).toBe(VECTOR.qr);
  });
});

describe('registry', () => {
  it('replaces the snapshot and remembers whose it is', async () => {
    await replaceRegistry(ISSUER, [tool(), tool({ id: 'other', name: 'Пила' })], 111);
    expect((await listTools()).map((t) => t.name).sort()).toEqual(['Дрель Bosch', 'Пила']);
    expect((await getMeta('registry'))?.ownerUserId).toBe(ISSUER);

    await replaceRegistry(ISSUER, [tool()], 222); // 'other' was written off meanwhile
    expect(await listTools()).toHaveLength(1);
    expect(await getTool('other')).toBeUndefined();
  });

  it('clearRegistry wipes tools and owner', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    await clearRegistry();
    expect(await listTools()).toHaveLength(0);
    expect(await getMeta('registry')).toBeUndefined();
  });
});

describe('journal: confirm', () => {
  it('writes the journal record AND updates the tool in one go (TAKE)', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const payload = await payloadOf(await forgeQr({ operation: { toolCondition: 'Damaged' } }));

    const entry = await confirmOperation({ userId: ISSUER, payload, scannedAt: 1790003605 });
    expect(entry).toMatchObject({ id: 1, status: 'pending', scannedAt: 1790003605, qr: payload.qr });

    expect(await getTool(TOOL_ID)).toMatchObject({
      condition: 'Damaged',
      holderId: WORKER_ID,
      holderName: 'Иванов Иван Иванович',
      heldSince: 1790003600,
    });
    expect(await hasWorkerSignature(ISSUER, payload.workerSignature)).toBe(true);
    expect(await hasWorkerSignature(OTHER_ISSUER, payload.workerSignature)).toBe(false);
  });

  it('GIVE clears the holder', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    await confirmOperation({ userId: ISSUER, payload: await payloadOf(await forgeQr()), scannedAt: 1790003601 });
    const give = await payloadOf(await forgeQr({ operation: { action: 'GIVE', timestamp: 1790007200 } }));
    await confirmOperation({ userId: ISSUER, payload: give, scannedAt: 1790007201 });
    expect(await getTool(TOOL_ID)).toMatchObject({ holderId: null, holderName: null, heldSince: null });
  });

  it('an older operation synced late does not overwrite a newer local state', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const newer = await payloadOf(await forgeQr({ operation: { toolCondition: 'Broken', timestamp: 1790010000 } }));
    const older = await payloadOf(await forgeQr({ operation: { toolCondition: 'Good', timestamp: 1790005000 } }));
    await confirmOperation({ userId: ISSUER, payload: newer, scannedAt: 1790010001 });
    await confirmOperation({ userId: ISSUER, payload: older, scannedAt: 1790010002 });
    expect((await getTool(TOOL_ID))?.condition).toBe('Broken');
  });

  it('a duplicate QR is refused and changes nothing', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const payload = await payloadOf(await forgeQr());
    await confirmOperation({ userId: ISSUER, payload, scannedAt: 1 });
    const before = await getTool(TOOL_ID);

    await expect(confirmOperation({ userId: ISSUER, payload, scannedAt: 2 })).rejects.toBeInstanceOf(DuplicateQrError);
    expect(await countByStatus(ISSUER)).toEqual({ pending: 1, sent: 0, quarantined: 0 });
    expect(await getTool(TOOL_ID)).toEqual(before);
  });

  it('two scans racing for the same QR: exactly one wins', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const payload = await payloadOf(await forgeQr());
    const results = await Promise.allSettled([
      confirmOperation({ userId: ISSUER, payload, scannedAt: 1 }),
      confirmOperation({ userId: ISSUER, payload, scannedAt: 1 }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await countByStatus(ISSUER)).pending).toBe(1);
  });

  it('works for a tool that is not in the registry (UNKNOWN_TOOL is only a warning)', async () => {
    const payload = await payloadOf(await forgeQr());
    await confirmOperation({ userId: ISSUER, payload, scannedAt: 1 });
    expect(await listTools()).toHaveLength(0);
    expect((await countByStatus(ISSUER)).pending).toBe(1);
  });

  it('the same QR may exist for two different issuers (their journals are separate)', async () => {
    const payload = await payloadOf(await forgeQr());
    await confirmOperation({ userId: ISSUER, payload, scannedAt: 1 });
    await confirmOperation({ userId: OTHER_ISSUER, payload, scannedAt: 1 });
    expect((await countByStatus(OTHER_ISSUER)).pending).toBe(1);
  });
});

describe('journal: queue and sync statuses', () => {
  async function addThree() {
    const entries = [];
    for (const [i, t] of [1790003600, 1790003700, 1790003800].entries()) {
      const payload = await payloadOf(await forgeQr({ operation: { timestamp: t } }));
      entries.push(await confirmOperation({ userId: ISSUER, payload, scannedAt: t + 1 + i }));
    }
    return entries;
  }

  it('lists pending records in scan order and counts statuses per user', async () => {
    await addThree();
    expect((await listByStatus(ISSUER, 'pending')).map((e) => e.id)).toEqual([1, 2, 3]);
    expect(await countByStatus(OTHER_ISSUER)).toEqual({ pending: 0, sent: 0, quarantined: 0 });
  });

  it('markSent stores the server verdict and moves the record out of pending', async () => {
    const [a, b] = await addThree();
    await markSent(
      [
        { id: a.id!, logId: 41, validationFlag: 'VALID' },
        { id: b.id!, logId: 42, validationFlag: 'TIME_DRIFT' },
      ],
      999,
    );
    expect(await countByStatus(ISSUER)).toEqual({ pending: 1, sent: 2, quarantined: 0 });
    const sent = await listByStatus(ISSUER, 'sent');
    expect(sent.map((e) => [e.logId, e.validationFlag, e.sentAt])).toEqual([
      [41, 'VALID', 999],
      [42, 'TIME_DRIFT', 999],
    ]);
    // the QR itself is never touched
    expect(sent[0].qr).toBe(a.qr);
  });

  it('markSent twice (a retried response) does not overwrite the first result', async () => {
    const [a] = await addThree();
    await markSent([{ id: a.id!, logId: 41, validationFlag: 'VALID' }]);
    await markSent([{ id: a.id!, logId: 99, validationFlag: 'DUPLICATE' }]);
    expect((await listByStatus(ISSUER, 'sent'))[0]).toMatchObject({ logId: 41, validationFlag: 'VALID' });
  });

  it('quarantine sets records aside with a reason and keeps them out of the send queue', async () => {
    const [a, , c] = await addThree();
    await quarantine([a.id!, c.id!], '[0].qr: формат');
    expect((await listByStatus(ISSUER, 'pending')).map((e) => e.id)).toEqual([2]);
    expect((await listByStatus(ISSUER, 'quarantined')).map((e) => e.quarantineReason)).toEqual([
      '[0].qr: формат',
      '[0].qr: формат',
    ]);
  });

  it('listRecent is newest first across statuses', async () => {
    const [a] = await addThree();
    await markSent([{ id: a.id!, logId: 1, validationFlag: 'VALID' }]);
    expect((await listRecent(ISSUER, 2)).map((e) => e.id)).toEqual([3, 2]);
  });
});

describe('registry reload keeps pending operations', () => {
  it('re-applies unsynced operations on top of a fresh server snapshot', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const payload = await payloadOf(await forgeQr({ operation: { toolCondition: 'Damaged' } }));
    await confirmOperation({ userId: ISSUER, payload, scannedAt: 1 });

    // the server has not seen the operation yet: it still says Good / on the shelf
    await replaceRegistry(ISSUER, [tool()]);
    expect(await getTool(TOOL_ID)).toMatchObject({ condition: 'Damaged', holderId: WORKER_ID });
  });

  it('does NOT re-apply operations that are already synced (the server snapshot has them)', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    const entry = await confirmOperation({ userId: ISSUER, payload: await payloadOf(await forgeQr()), scannedAt: 1 });
    await markSent([{ id: entry.id!, logId: 1, validationFlag: 'VALID' }]);

    await replaceRegistry(ISSUER, [tool({ holderId: null, condition: 'Good' })]); // e.g. a later GIVE already on the server
    expect(await getTool(TOOL_ID)).toMatchObject({ holderId: null });
  });

  it('only this issuer\'s pending operations are applied', async () => {
    await replaceRegistry(ISSUER, [tool()]);
    await confirmOperation({ userId: OTHER_ISSUER, payload: await payloadOf(await forgeQr()), scannedAt: 1 });
    await replaceRegistry(ISSUER, [tool()]);
    expect(await getTool(TOOL_ID)).toMatchObject({ holderId: null });
  });
});

describe('worker: own operations', () => {
  const op = (over: Partial<Parameters<typeof recordOwnOperation>[0]> = {}) => ({
    workerSignature: `sig-${Math.random()}`,
    userId: WORKER_ID,
    qr: 'qr',
    toolId: TOOL_ID,
    toolName: 'Дрель Bosch',
    action: 'TAKE' as const,
    toolCondition: 'Good' as const,
    timestamp: 100,
    createdAt: 1,
    ...over,
  });

  it('"tools on hand" = tools whose latest own operation is TAKE', async () => {
    await recordOwnOperation(op({ timestamp: 100 }));
    await recordOwnOperation(op({ toolId: 'saw', toolName: 'Пила', timestamp: 150 }));
    await recordOwnOperation(op({ action: 'GIVE', timestamp: 200 })); // the drill was returned
    expect(await toolsOnHand(WORKER_ID)).toEqual([{ toolId: 'saw', toolName: 'Пила', since: 150 }]);
  });

  it('is per user and newest first', async () => {
    await recordOwnOperation(op({ timestamp: 1 }));
    await recordOwnOperation(op({ timestamp: 2, userId: 'someone-else' }));
    await recordOwnOperation(op({ timestamp: 3 }));
    expect((await listOwnOperations(WORKER_ID)).map((o) => o.timestamp)).toEqual([3, 1]);
    expect(await toolsOnHand('nobody')).toEqual([]);
  });
});
