// src/api/journal.ts
import { useQuery } from '@tanstack/react-query';
import {
  actionToApi,
  toJournalRow,
  type JournalFilter,
  type JournalRow,
  type RentalLogEntry,
} from '../entities/journalModel';
import { mockLogEntries } from '../mock/journal';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/** Flip to false when the journal should come from the backend. */
const USE_MOCK = true;

/* ------------------------------- Raw functions ------------------------------ */

/**
 * GET /api/logs[?action=TAKE|GIVE] — Issuer and Owner, own company only,
 * newest first (by qrTimestamp, then id), all validation flags.
 */
export async function getJournal(filter: JournalFilter = 'all'): Promise<JournalRow[]> {
  if (USE_MOCK) {
    // Simulate latency so loading states are visible during dev
    await new Promise((r) => setTimeout(r, 300));
    const entries =
      filter === 'all'
        ? mockLogEntries
        : mockLogEntries.filter((e) => e.action === actionToApi[filter]);
    return entries.map(toJournalRow);
  }

  const query = filter === 'all' ? '' : `?action=${actionToApi[filter]}`;
  const response = await apiFetch(`/api/logs${query}`);
  if (!response.ok) throw new Error('Не удалось загрузить журнал');
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