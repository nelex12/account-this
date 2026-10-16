// src/api/journal.ts
import { useQuery } from '@tanstack/react-query';
import {
  actionToApi,
  toJournalRow,
  type JournalFilter,
  type JournalRow,
  type RentalLogEntry,
} from '../entities/journalModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/* --------------------------------- helpers --------------------------------- */

/** ProblemDetails.detail (Russian, meant for the user) if the body has one. */
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === 'string' ? body.detail : undefined;
  } catch {
    return undefined; // 401/403 from the JWT layer come without a body
  }
}

async function failFrom(response: Response, fallback: string): Promise<never> {
  if (response.status === 403) {
    throw new ApiError('Нет доступа к журналу для вашей роли', 403);
  }
  const detail = await readDetail(response);
  throw new ApiError(detail ?? `${fallback} (${response.status})`, response.status);
}

/* ------------------------------- Raw functions ------------------------------ */

/**
 * GET /api/logs[?action=TAKE|GIVE] — Issuer and Owner, own company only,
 * newest first (by qrTimestamp, then id), all validation flags.
 */
export async function getJournal(filter: JournalFilter = 'all'): Promise<JournalRow[]> {
  const query = filter === 'all' ? '' : `?action=${actionToApi[filter]}`;
  const response = await apiFetch(`/api/logs${query}`);
  if (!response.ok) return failFrom(response, 'Не удалось загрузить журнал');
  return ((await response.json()) as RentalLogEntry[]).map(toJournalRow);
}

/* ---------------------------------- Hooks ----------------------------------- */

/** The action filter is applied by the server (`action` query parameter). */
export function useJournal(filter: JournalFilter = 'all') {
  return useQuery({
    queryKey: [...queryKeys.journal, filter],
    queryFn: () => getJournal(filter),
  });
}