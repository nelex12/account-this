// src/api/overview.ts — data for the Owner "Обзор" page.
//
// The backend has no overview endpoint, so the page is assembled from three real ones
// (all allowed for Owner, all limited to the owner's company):
//   GET /api/tools — registry of active tools with their current holder
//   GET /api/users — users of the company (for pending access requests)
//   GET /api/logs  — journal, newest first
import { useQuery } from '@tanstack/react-query';
import {
  conditionFromApi,
  formatUnix,
  type Condition,
  type RentalLogEntry,
  type ToolConditionApi,
} from '../entities/journalModel';
import { mockApiLogs, mockApiTools, mockApiUsers } from '../mock/overview';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/** Flip to false when the backend responds (see the endpoints above). */
const USE_MOCK = true;

/* ---------------------------------- Types ----------------------------------- */

export type SummaryId = 'registry' | 'broken' | 'requests' | 'issued' | 'accepted' | 'waiting';

export interface OverviewSummary {
  id: SummaryId;
  label: string;
  value: number;
  caption?: string;
}

export interface OverviewHistoryRow {
  id: string;
  /** "HH:mm" for today's records, "dd.MM HH:mm" for older ones */
  time: string;
  toolName: string;
  action: string;
  employee: string;
  condition: Condition;
}

export interface OverviewData {
  summary: OverviewSummary[];
  history: OverviewHistoryRow[];
}

/** Only the fields of api.yaml schemas that the overview uses. */
export interface ApiTool {
  condition: ToolConditionApi;
  /** null — the tool is at the issuer's place */
  holderId: string | null;
}
export interface ApiUser {
  isApproved: boolean;
  isActive: boolean;
}

/* --------------------------------- Helpers ---------------------------------- */

const HISTORY_LIMIT = 6;

async function getJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(`Запрос ${path} не удался (${response.status})`);
  return (await response.json()) as T;
}

function startOfTodaySeconds(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function historyTime(seconds: number, todayStart: number): string {
  const full = formatUnix(seconds); // "02.10.2026 16:42"
  const [date, time] = full.split(' ');
  return seconds >= todayStart ? time : `${date.slice(0, 5)} ${time}`;
}

function buildOverview(tools: ApiTool[], users: ApiUser[], logs: RentalLogEntry[]): OverviewData {
  const todayStart = startOfTodaySeconds();

  const onHand = tools.filter((t) => t.holderId !== null).length;
  const damaged = tools.filter((t) => t.condition === 'Damaged').length;
  const broken = tools.filter((t) => t.condition === 'Broken').length;
  const requests = users.filter((u) => !u.isApproved && u.isActive).length;

  // Only records that passed all server checks count as real operations
  const validToday = logs.filter((l) => l.validationFlag === 'VALID' && l.qrTimestamp >= todayStart);

  return {
    summary: [
      { id: 'registry', label: 'Инструментов в реестре', value: tools.length, caption: `${onHand} на руках` },
      {
        id: 'broken',
        label: 'Неисправны',
        value: damaged + broken,
        caption: `${damaged} повреждены · ${broken} сломаны`,
      },
      { id: 'requests', label: 'Заявки на доступ', value: requests },
      { id: 'issued', label: 'Выдано сегодня', value: validToday.filter((l) => l.action === 'TAKE').length },
      { id: 'accepted', label: 'Принято сегодня', value: validToday.filter((l) => l.action === 'GIVE').length },
      // Tools that are out and have not been returned yet
      { id: 'waiting', label: 'Ожидают', value: onHand, caption: 'возврата' },
    ],
    history: logs.slice(0, HISTORY_LIMIT).map((l) => ({
      id: String(l.id),
      time: historyTime(l.qrTimestamp, todayStart),
      toolName: l.toolName,
      action: l.action === 'TAKE' ? 'Выдача' : 'Возврат',
      employee: l.workerName,
      condition: conditionFromApi[l.toolCondition],
    })),
  };
}

/* ------------------------------- Raw functions ------------------------------ */

export async function getOverview(): Promise<OverviewData> {
  if (USE_MOCK) {
    // Simulate latency so loading states are visible during dev
    await new Promise((r) => setTimeout(r, 300));
    return buildOverview(mockApiTools, mockApiUsers, mockApiLogs);
  }

  const [tools, users, logs] = await Promise.all([
    getJson<ApiTool[]>('/api/tools'),
    getJson<ApiUser[]>('/api/users'),
    getJson<RentalLogEntry[]>('/api/logs'), // already newest first
  ]);
  return buildOverview(tools, users, logs);
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: getOverview,
  });
}