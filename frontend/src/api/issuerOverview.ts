// src/api/issuerOverview.ts — data for the Issuer "Обзор" page.
//
// The backend has no overview endpoint. The page is assembled from:
//   * server journal — GET /api/logs, records of THIS issuer (issuerId === user id)
//   * local queue    — scanned QRs not yet sent via POST /api/sync. The offline queue
//                      does not exist in the app yet, so it is always empty here
//                      (pendingCount = 0). See `readLocalQueueSize`.
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

/** Records scanned on this device and not sent yet. No offline queue yet -> 0. */
function readLocalQueueSize(): number {
  return 0;
}

/* ------------------------------- Raw functions ------------------------------ */

/** GET /api/logs (newest first) narrowed to the records this issuer synced. */
export async function getIssuerOverview(issuerId: string): Promise<IssuerOverviewData> {
  const response = await apiFetch('/api/logs');
  if (!response.ok) {
    throw new ApiError(`Не удалось загрузить журнал (${response.status})`, response.status);
  }
  const own = ((await response.json()) as RentalLogEntry[]).filter((e) => e.issuerId === issuerId);

  const today = startOfTodaySeconds();
  const todays = own.filter((e) => e.qrTimestamp >= today);

  return {
    // createdAt = when the record reached the server = the issuer's last sync
    lastSyncAt: own.length ? Math.max(...own.map((e) => e.createdAt)) : null,
    pendingCount: readLocalQueueSize(),
    issuedToday: todays.filter((e) => e.action === 'TAKE').length,
    acceptedToday: todays.filter((e) => e.action === 'GIVE').length,
    history: own.slice(0, HISTORY_LIMIT).map((e) => ({
      id: String(e.id),
      time: e.qrTimestamp,
      action: e.action,
      toolName: e.toolName,
      workerName: e.workerName,
      toolCondition: e.toolCondition,
      sync: e.validationFlag,
    })),
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
  });
}

export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}