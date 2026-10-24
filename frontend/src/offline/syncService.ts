// syncService.ts — sends the issuer's local journal to POST /api/sync. No React, no fetch: the HTTP
// call is injected (`send`), so the whole logic is testable.
//
// Rules (api.yaml, "Sync"):
//   * only THIS issuer's `pending` records are sent (the server takes issuer_id from the JWT);
//   * oldest first, in batches; results come back in the order of the request -> markSent;
//   * 200 -> every record is saved by the server, each with its own validationFlag (not only VALID);
//   * 400 with "[n].qr" keys -> those records have a broken AT1 format: they are set aside
//     (`quarantined`, kept for inspection, never resent) and the REST is sent again, so one bad record
//     cannot block the queue; a 400 without such keys is a bug/other problem: nothing is changed;
//   * network failure / 401 / 403 / 5xx -> an exception, everything stays `pending`;
//   * resending after a lost response is safe: the server is idempotent per (issuer, scannedAt, qr).
import type { ValidationFlag } from '../entities/journalModel';
import { getMeta, getServerNowSec, setMeta } from './meta';
import { listByStatus, markSent, quarantine } from './journal';

export interface SyncRecordDto {
  qr: string;
  scannedAt: number;
}

export type SendResult =
  | { kind: 'ok'; results: { logId: number; validationFlag: ValidationFlag }[] }
  | { kind: 'badFormat'; bad: { index: number; message: string }[] };

export type SendFn = (records: SyncRecordDto[]) => Promise<SendResult>;

export interface SyncSummary {
  /** Records the server accepted in this run (with any flag) */
  sent: number;
  /** Records set aside because their format was rejected */
  quarantined: number;
  /** How many of the sent records the server flagged as not VALID, per flag */
  flagged: Partial<Record<Exclude<ValidationFlag, 'VALID'>, number>>;
}

export class SyncError extends Error {}

export const SYNC_BATCH_SIZE = 100;

/** "[3].qr" -> 3. Anything else (body-level errors, other fields) is ignored. */
export function parseBadRecords(errors: unknown): { index: number; message: string }[] {
  if (!errors || typeof errors !== 'object') return [];
  const result: { index: number; message: string }[] = [];
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const match = /^\[(\d+)\]\.qr$/.exec(key);
    if (!match) continue;
    const message = Array.isArray(value) && typeof value[0] === 'string' ? value[0] : 'Строка QR не соответствует формату AT1';
    result.push({ index: Number(match[1]), message });
  }
  return result.sort((a, b) => a.index - b.index);
}

export async function syncJournal(args: {
  userId: string;
  send: SendFn;
  batchSize?: number;
}): Promise<SyncSummary> {
  const { userId, send, batchSize = SYNC_BATCH_SIZE } = args;
  const summary: SyncSummary = { sent: 0, quarantined: 0, flagged: {} };

  let queue = await listByStatus(userId, 'pending');
  while (queue.length > 0) {
    const batch = queue.slice(0, batchSize);
    const answer = await send(batch.map((e) => ({ qr: e.qr, scannedAt: e.scannedAt })));

    if (answer.kind === 'ok') {
      if (answer.results.length !== batch.length) {
        throw new SyncError('Сервер вернул неожиданное число результатов');
      }
      await markSent(
        batch.map((e, i) => ({
          id: e.id!,
          logId: answer.results[i].logId,
          validationFlag: answer.results[i].validationFlag,
        })),
      );
      summary.sent += batch.length;
      for (const r of answer.results) {
        if (r.validationFlag !== 'VALID') summary.flagged[r.validationFlag] = (summary.flagged[r.validationFlag] ?? 0) + 1;
      }
      await setMeta('lastSyncAt', { ...(await getMeta('lastSyncAt')), [userId]: await getServerNowSec() });
      queue = queue.slice(batch.length);
      continue;
    }

    // 400: set the bad ones aside, send the rest again (they are in `queue` still)
    const bad = answer.bad.filter((b) => b.index >= 0 && b.index < batch.length);
    if (bad.length === 0) throw new SyncError('Сервер отклонил запрос синхронизации');
    for (const b of bad) await quarantine([batch[b.index].id!], b.message);
    summary.quarantined += bad.length;
    const gone = new Set(bad.map((b) => batch[b.index].id));
    queue = queue.filter((e) => !gone.has(e.id));
  }
  return summary;
}
