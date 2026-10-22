// journal.ts — the Issuer's local journal (store `journal`): scanned QRs waiting for POST /api/sync.
//
// Records are never changed or deleted, only their send status moves:
//   pending -> sent          (the server answered {logId, validationFlag})
//   pending -> quarantined   (the server rejected the QR format: "[n].qr" in a 400)
// Every query is per user: the server takes issuer_id from the JWT, so one issuer must never
// send records another issuer scanned on the same device.
import type { ValidationFlag } from '../entities/journalModel';
import type { At1Payload } from './at1';
import { getDb, type JournalEntry, type JournalStatus } from './db';
import { applyOperationToTool } from './registry';

/** The same QR (workerSignature) was already confirmed by this issuer. */
export class DuplicateQrError extends Error {
  constructor() {
    super('QR already in the local journal');
  }
}

export async function hasWorkerSignature(userId: string, workerSignature: string): Promise<boolean> {
  const key = await (await getDb()).getKeyFromIndex('journal', 'by-user-signature', [userId, workerSignature]);
  return key !== undefined;
}

/**
 * The Issuer's "Confirm": writes the journal record AND applies the operation to the local
 * registry in ONE transaction, so they cannot diverge. The unique index rejects a duplicate
 * even if two scans race: DuplicateQrError, nothing is changed.
 */
export async function confirmOperation(args: {
  userId: string;
  payload: At1Payload;
  /** Server time of the scan, Unix seconds */
  scannedAt: number;
}): Promise<JournalEntry> {
  const { userId, payload, scannedAt } = args;
  const db = await getDb();
  const tx = db.transaction(['journal', 'tools'], 'readwrite');
  // Observe completion from the start: a failed request aborts the transaction by itself,
  // and an unobserved `done` rejection would surface as an unhandled rejection.
  const done = tx.done.catch(() => {});

  const entry: JournalEntry = {
    userId,
    qr: payload.qr,
    scannedAt,
    workerSignature: payload.workerSignature,
    status: 'pending',
    createdAt: Date.now(),
  };

  let id: number;
  try {
    id = await tx.objectStore('journal').add(entry);
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already aborting after the failed request */
    }
    await done;
    if (e instanceof DOMException && e.name === 'ConstraintError') throw new DuplicateQrError();
    throw e;
  }

  const tools = tx.objectStore('tools');
  const tool = await tools.get(payload.operation.toolId);
  if (tool) await tools.put(applyOperationToTool(tool, payload.operation, payload.tokenData));

  await tx.done;
  return { ...entry, id };
}

export async function listByStatus(userId: string, status: JournalStatus): Promise<JournalEntry[]> {
  const rows = await (await getDb()).getAllFromIndex('journal', 'by-user-status', [userId, status]);
  return rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)); // scan order
}

/** Newest first, all statuses: the "history" list. */
export async function listRecent(userId: string, limit = 20): Promise<JournalEntry[]> {
  const all = await Promise.all(
    (['pending', 'sent', 'quarantined'] as const).map((s) => listByStatus(userId, s)),
  );
  return all.flat().sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, limit);
}

export async function countByStatus(userId: string): Promise<Record<JournalStatus, number>> {
  const db = await getDb();
  const [pending, sent, quarantined] = await Promise.all(
    (['pending', 'sent', 'quarantined'] as const).map((s) =>
      db.countFromIndex('journal', 'by-user-status', [userId, s]),
    ),
  );
  return { pending, sent, quarantined };
}

/** After a successful POST /api/sync: results come in the order of the request. */
export async function markSent(
  results: { id: number; logId: number; validationFlag: ValidationFlag }[],
  sentAt: number = Date.now(),
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('journal', 'readwrite');
  for (const r of results) {
    const entry = await tx.store.get(r.id);
    if (entry && entry.status === 'pending') {
      await tx.store.put({ ...entry, status: 'sent', logId: r.logId, validationFlag: r.validationFlag, sentAt });
    }
  }
  await tx.done;
}

/** Sets records aside (server said their format is invalid): they are kept for inspection, not resent. */
export async function quarantine(ids: number[], reason: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('journal', 'readwrite');
  for (const id of ids) {
    const entry = await tx.store.get(id);
    if (entry && entry.status === 'pending') {
      await tx.store.put({ ...entry, status: 'quarantined', quarantineReason: reason });
    }
  }
  await tx.done;
}
