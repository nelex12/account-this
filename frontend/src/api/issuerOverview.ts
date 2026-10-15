// src/api/issuerOverview.ts — data for the Issuer "Обзор" page.
//
// The backend has no overview endpoint. The page is assembled from two sources:
//   * server journal  — GET /api/logs (records already synced; see api/journal.ts)
//   * local queue     — the issuer's offline journal: scanned QRs not yet sent via POST /api/sync
// Both are mocked here. Replace `getIssuerOverview` / `syncNow` with the real thing later;
// the shapes below are what the page needs, so the page itself stays untouched.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RentalAction, ToolConditionApi, ValidationFlag } from '../entities/journalModel';
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

/* --------------------------------- Mocks ----------------------------------- */

const now = () => Math.floor(Date.now() / 1000);
const ago = (minutes: number) => now() - minutes * 60;

const mockState = {
  lastSyncAt: ago(120) as number | null,
  items: [
    { id: 'l7', time: ago(15), action: 'GIVE', toolName: 'Гайковёрт Makita DTW300', workerName: 'Васильев К. С.', toolCondition: 'Good', sync: 'pending' },
    { id: 'l6', time: ago(40), action: 'TAKE', toolName: 'Краскопульт BD 390', workerName: 'Смирнова Е. В.', toolCondition: 'Good', sync: 'pending' },
    { id: 'l5', time: ago(75), action: 'GIVE', toolName: 'Строительный фен Steinel HL 3978', workerName: 'Орлов М. К.', toolCondition: 'Damaged', sync: 'pending' },
    { id: '104', time: ago(130), action: 'TAKE', toolName: 'Шуруповёрт Metabo BS', workerName: 'Кузнецов Д. А.', toolCondition: 'Good', sync: 'VALID' },
    { id: '103', time: ago(180), action: 'GIVE', toolName: 'Перфоратор Bosch GBH 2-26', workerName: 'Иванов И. И.', toolCondition: 'Broken', sync: 'VALID' },
    { id: '102', time: ago(240), action: 'TAKE', toolName: 'Лазерный уровень GLL 3-80', workerName: 'Васильев К. С.', toolCondition: 'Good', sync: 'TIME_DRIFT' },
    { id: '101', time: ago(300), action: 'TAKE', toolName: 'Болгарка DeWalt DWE4157', workerName: 'Новиков С. Р.', toolCondition: 'Good', sync: 'VALID' },
  ] as IssuerHistoryItem[],
};

function startOfTodaySeconds(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/* ------------------------------- Raw functions ------------------------------ */

export async function getIssuerOverview(): Promise<IssuerOverviewData> {
  await new Promise((r) => setTimeout(r, 300));
  const today = startOfTodaySeconds();
  const todays = mockState.items.filter((i) => i.time >= today);
  return {
    lastSyncAt: mockState.lastSyncAt,
    pendingCount: mockState.items.filter((i) => i.sync === 'pending').length,
    issuedToday: todays.filter((i) => i.action === 'TAKE').length,
    acceptedToday: todays.filter((i) => i.action === 'GIVE').length,
    history: [...mockState.items].sort((a, b) => b.time - a.time),
  };
}

/**
 * Real version: send the local queue — POST /api/sync with [{ qr, scannedAt }, ...] —
 * then store each SyncResult.validationFlag on its record and set lastSyncAt.
 * (A 400 lists bad records as "[n].qr": set those aside and resend the rest, see api.yaml.)
 */
export async function syncNow(): Promise<void> {
  await new Promise((r) => setTimeout(r, 800));
  mockState.items = mockState.items.map((i) => (i.sync === 'pending' ? { ...i, sync: 'VALID' } : i));
  mockState.lastSyncAt = now();
}

/* ---------------------------------- Hooks ----------------------------------- */

const key = [...queryKeys.overview, 'issuer'] as const;

export function useIssuerOverview() {
  return useQuery({ queryKey: key, queryFn: getIssuerOverview });
}

export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}