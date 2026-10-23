// src/api/issuerOverview.ts — data for the Issuer "Обзор" page.
//
// The backend has no overview endpoint. The page is assembled from:
//   * server journal — GET /api/logs, records of THIS issuer (issuerId === user id)
//   * local journal  — QRs confirmed on this device (IndexedDB), not yet sent via POST /api/sync.
//                      Shown first as 'pending'. Sending itself is the next step (see `syncNow`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../app/providers/AuthProvider';
import type {
  RentalAction,
  RentalLogEntry,
  ToolConditionApi,
  ValidationFlag,
} from '../entities/journalModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';
import { countByStatus, listByStatus } from '../offline/journal';
import { getMeta } from '../offline/meta';
import type { JournalEntry } from '../offline/db';
import { parseAt1 } from '../offline/at1';

/* ---------------------------------- Types ----------------------------------- */

/**
 * 'pending' — scanned, still only on this device (not sent yet).
 * Otherwise the server's verdict for the record (validationFlag); 'VALID' = accepted.
 */
export type IssuerSyncState = 'pending' | ValidationFlag;

export interface IssuerHistoryItem {
  /** Server log id (number) or local queue id (string) */
  id: string;
  /** Operation time, Unix seconds */
  time: number;
  action: RentalAction;
  toolName: string;
  workerName: string;
  toolCondition: ToolConditionApi;
  sync: IssuerSyncState;
}

export interface IssuerOverviewData {
  /** Unix seconds of the last successful POST /api/sync; null — never synced */
  lastSyncAt: number | null;
  /** Records waiting in the local queue */
  pendingCount: number;
  /** TAKE records of today */
  issuedToday: number;
  /** GIVE records of today */
  acceptedToday: number;
  /** Newest first */
  history: IssuerHistoryItem[];
}

/* --------------------------------- helpers --------------------------------- */

const HISTORY_LIMIT = 20;

function startOfTodaySeconds(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/** A journal record that is still on this device, shown as a history row. */
function localItem(entry: JournalEntry): IssuerHistoryItem | null {
  const parsed = parseAt1(entry.qr);
  if (!parsed.ok) return null;
  const { operation, tokenData } = parsed.payload;
  return {
    id: `local-${entry.id}`,
    time: operation.timestamp,
    action: operation.action,
    toolName: operation.toolName,
    workerName: tokenData.fio,
    toolCondition: operation.toolCondition,
    sync: 'pending',
  };
}

/** What this device holds for the issuer (works offline). */
async function readLocal(issuerId: string): Promise<{ pending: IssuerHistoryItem[]; lastSyncAt: number | null }> {
  const entries = await listByStatus(issuerId, 'pending');
  const lastSync = (await getMeta('lastSyncAt'))?.[issuerId];
  return {
    pending: entries.map(localItem).filter((i): i is IssuerHistoryItem => i !== null).reverse(),
    lastSyncAt: typeof lastSync === 'number' ? lastSync : null,
  };
}

/* ------------------------------- Raw functions ------------------------------ */

/** GET /api/logs (newest first) narrowed to the records this issuer synced. */
export async function getIssuerOverview(issuerId: string): Promise<IssuerOverviewData> {
  const local = await readLocal(issuerId);
  const counts = await countByStatus(issuerId);
  let own: RentalLogEntry[] = [];
  try {
    const response = await apiFetch('/api/logs');
    if (!response.ok) {
      throw new ApiError(`Не удалось загрузить журнал (${response.status})`, response.status);
    }
    own = ((await response.json()) as RentalLogEntry[]).filter((e) => e.issuerId === issuerId);
  } catch (e) {
    // Offline: show what is on the device. With nothing local either, the error is real.
    if (counts.pending + counts.sent === 0 && local.lastSyncAt === null) throw e;
  }

  const today = startOfTodaySeconds();
  const todays = own.filter((e) => e.qrTimestamp >= today);
  const localToday = local.pending.filter((i) => i.time >= today);

  return {
    // createdAt = when the record reached the server = the issuer's last sync
    lastSyncAt: own.length ? Math.max(...own.map((e) => e.createdAt)) : local.lastSyncAt,
    pendingCount: counts.pending,
    issuedToday: todays.filter((e) => e.action === 'TAKE').length + localToday.filter((i) => i.action === 'TAKE').length,
    acceptedToday: todays.filter((e) => e.action === 'GIVE').length + localToday.filter((i) => i.action === 'GIVE').length,
    history: [...local.pending, ...own.map((e): IssuerHistoryItem => ({
      id: String(e.id),
      time: e.qrTimestamp,
      action: e.action,
      toolName: e.toolName,
      workerName: e.workerName,
      toolCondition: e.toolCondition,
      sync: e.validationFlag,
    }))].slice(0, HISTORY_LIMIT),
  };
}

/**
 * "Send now". With no local queue there is nothing to POST to /api/sync, so this
 * only lets the hook below re-read the journal. When the queue appears: send
 * [{ qr, scannedAt }, ...], store each SyncResult.validationFlag (a 400 lists bad
 * records as "[n].qr": set those aside and resend the rest, see api.yaml).
 */
export async function syncNow(): Promise<void> {
  return;
}

/* ---------------------------------- Hooks ----------------------------------- */

const key = [...queryKeys.overview, 'issuer'] as const;

export function useIssuerOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...key, user?.id],
    queryFn: () => {
      if (!user) throw new Error('Not signed in');
      return getIssuerOverview(user.id);
    },
    enabled: Boolean(user),
    // the journal lives in IndexedDB: it must load without a network
    networkMode: 'always',
  });
}

export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}