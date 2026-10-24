// IssuerOfflineProvider.tsx — keeps the Issuer ready to work without internet, and sends what was
// scanned as soon as there is a network.
//
// While online it
//   1. downloads the server public key and the tools registry (offline/issuerDataService.ts);
//   2. sends the pending journal records to POST /api/sync (api/sync.ts) and downloads the registry
//      again, so the local copy shows what the server decided.
// Both run: on app start, when the connection returns, when the app comes back to the foreground,
// right after a record is confirmed, and every few minutes. Pages read `status` and call `syncNow()`.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { fetchServerKey } from '../../api/serverKey';
import { queryKeys } from '../../api/queryKeys';
import { runIssuerSync } from '../../api/sync';
import { getTools } from '../../api/tools';
import { JOURNAL_CHANGED_EVENT } from '../../offline/events';
import { readIssuerDataStatus, refreshIssuerData, type IssuerDataStatus } from '../../offline/issuerDataService';
import { countByStatus } from '../../offline/journal';
import { ISSUER_DATA_LOCK, withLock } from '../../offline/lock';
import type { SyncSummary } from '../../offline/syncService';
import { useAuth } from './AuthProvider';

interface IssuerOfflineContextValue {
  /** null until the first read of the local data */
  status: IssuerDataStatus | null;
  /** Downloads the key and the registry again now (if online) */
  refresh: () => Promise<void>;
  /** Sends the pending records now. Rejects when it could not (no network, server error). */
  syncNow: () => Promise<SyncSummary>;
  /** A send is running */
  syncing: boolean;
}

const IssuerOfflineContext = createContext<IssuerOfflineContextValue | null>(null);

const RECHECK_MS = 2 * 60_000;
/** Visibility/online events can fire in bursts: do not hit the server more often than this */
const MIN_GAP_MS = 30_000;
/** After a confirm: wait a moment so several quick scans go out in one request */
const AFTER_CONFIRM_MS = 1_500;

export function IssuerOfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const issuerId = user?.id;
  const [status, setStatus] = useState<IssuerDataStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const lastRun = useRef(0);
  const running = useRef<Promise<void> | null>(null);
  const syncCount = useRef(0);

  const run = useCallback(
    async (force: boolean) => {
      if (!issuerId) return;
      if (running.current) return running.current;
      if (!force && Date.now() - lastRun.current < MIN_GAP_MS) return;
      lastRun.current = Date.now();
      const task = (async () => {
        await withLock(ISSUER_DATA_LOCK, () =>
          refreshIssuerData({
            issuerId,
            fetchServerKey,
            fetchTools: getTools,
            online: navigator.onLine,
          }),
        );
        setStatus(await readIssuerDataStatus(issuerId));
      })();
      running.current = task;
      try {
        await task;
      } finally {
        running.current = null;
      }
    },
    [issuerId],
  );

  const syncNow = useCallback(async (): Promise<SyncSummary> => {
    if (!issuerId) throw new Error('Not signed in');
    syncCount.current += 1;
    setSyncing(true);
    try {
      const summary = await runIssuerSync(issuerId);
      setStatus(await readIssuerDataStatus(issuerId));
      return summary;
    } finally {
      syncCount.current -= 1;
      if (syncCount.current === 0) setSyncing(false);
      // the overview shows the journal and the server log: re-read both, success or not
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    }
  }, [issuerId, queryClient]);

  useEffect(() => {
    if (!issuerId) return;
    let cancelled = false;
    let afterConfirm: number | undefined;

    /** Sends in the background when there is something to send and a network to send it over. */
    const autoSync = async () => {
      if (!navigator.onLine) return;
      if ((await countByStatus(issuerId)).pending === 0) return;
      await syncNow();
    };
    const tick = (force: boolean) => {
      void run(force)
        .then(autoSync)
        .catch(() => {}); // a failed background attempt is retried by the next trigger
    };

    // show what is already on the device right away (also the whole story when offline)
    void readIssuerDataStatus(issuerId).then((s) => {
      if (!cancelled) setStatus(s);
    });
    tick(true);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick(false);
    };
    const onOnline = () => tick(true);
    const onJournalChanged = () => {
      window.clearTimeout(afterConfirm);
      afterConfirm = window.setTimeout(() => void autoSync().catch(() => {}), AFTER_CONFIRM_MS);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener(JOURNAL_CHANGED_EVENT, onJournalChanged);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => tick(false), RECHECK_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(afterConfirm);
      window.removeEventListener('online', onOnline);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, onJournalChanged);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [issuerId, run, syncNow]);

  const value = useMemo(
    () => ({ status, refresh: () => run(true), syncNow, syncing }),
    [status, run, syncNow, syncing],
  );
  return <IssuerOfflineContext.Provider value={value}>{children}</IssuerOfflineContext.Provider>;
}

export function useIssuerOffline(): IssuerOfflineContextValue {
  const ctx = useContext(IssuerOfflineContext);
  if (!ctx) throw new Error('useIssuerOffline must be used inside <IssuerOfflineProvider>');
  return ctx;
}
