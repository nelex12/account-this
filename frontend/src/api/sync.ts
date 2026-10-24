// src/api/sync.ts — POST /api/sync (Issuer only) and the "send everything now" routine.
import type { ValidationFlag } from '../entities/journalModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { fetchServerKey } from './serverKey';
import { getTools } from './tools';
import { refreshIssuerData } from '../offline/issuerDataService';
import { ISSUER_DATA_LOCK, withLock } from '../offline/lock';
import {
  parseBadRecords,
  syncJournal,
  type SendResult,
  type SyncRecordDto,
  type SyncSummary,
} from '../offline/syncService';

/** One request. Returns what the sync service understands; anything else is an exception. */
export async function postSync(records: SyncRecordDto[]): Promise<SendResult> {
  const response = await apiFetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });

  if (response.ok) {
    return { kind: 'ok', results: (await response.json()) as { logId: number; validationFlag: ValidationFlag }[] };
  }
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as { errors?: unknown } | null;
    const bad = parseBadRecords(body?.errors);
    if (bad.length > 0) return { kind: 'badFormat', bad };
  }
  throw new ApiError(`Не удалось отправить записи (${response.status})`, response.status);
}

/**
 * Sends this issuer's pending records, then (if the server took any) downloads the registry again:
 * the server has applied the VALID ones, and the local copy should show the server's truth.
 * Holds the same lock as the data refresh, so the two never run over each other (also across tabs).
 */
export function runIssuerSync(issuerId: string): Promise<SyncSummary> {
  return withLock(ISSUER_DATA_LOCK, async () => {
    const summary = await syncJournal({ userId: issuerId, send: postSync });
    if (summary.sent > 0) {
      await refreshIssuerData({ issuerId, fetchServerKey, fetchTools: getTools, online: navigator.onLine });
    }
    return summary;
  });
}
