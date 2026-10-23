// IssuerOfflineProvider.tsx — keeps the Issuer ready to work without internet.
//
// While online it downloads the server public key and the tools registry (see
// offline/issuerDataService.ts): on app start, when the connection returns, when the app comes back to
// the foreground, and every 10 minutes. Pages read `status` (is verification possible? when was the
// registry loaded?) with useIssuerOffline().
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchServerKey } from '../../api/serverKey';
import { getTools } from '../../api/tools';
import { readIssuerDataStatus, refreshIssuerData, type IssuerDataStatus } from '../../offline/issuerDataService';
import { useAuth } from './AuthProvider';

interface IssuerOfflineContextValue {
  /** null until the first read of the local data */
  status: IssuerDataStatus | null;
  /** Downloads again now (if online) */
  refresh: () => Promise<void>;
}

const IssuerOfflineContext = createContext<IssuerOfflineContextValue | null>(null);

const RECHECK_MS = 10 * 60_000;
/** Visibility/online events can fire in bursts: do not hit the server more often than this */
const MIN_GAP_MS = 30_000;

export function IssuerOfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const issuerId = user?.id;
  const [status, setStatus] = useState<IssuerDataStatus | null>(null);
  const lastRun = useRef(0);
  const running = useRef<Promise<void> | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      if (!issuerId) return;
      if (running.current) return running.current;
      if (!force && Date.now() - lastRun.current < MIN_GAP_MS) return;
      lastRun.current = Date.now();
      const task = (async () => {
        await refreshIssuerData({
          issuerId,
          fetchServerKey,
          fetchTools: getTools,
          online: navigator.onLine,
        });
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

  useEffect(() => {
    if (!issuerId) return;
    let cancelled = false;
    // show what is already on the device right away (also the whole story when offline)
    void readIssuerDataStatus(issuerId).then((s) => {
      if (!cancelled) setStatus(s);
    });
    void run(true).catch(() => {});

    const again = () => void run(false).catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === 'visible') again();
    };
    const onOnline = () => void run(true).catch(() => {});
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(again, RECHECK_MS);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [issuerId, run]);

  const value = useMemo(() => ({ status, refresh: () => run(true) }), [status, run]);
  return <IssuerOfflineContext.Provider value={value}>{children}</IssuerOfflineContext.Provider>;
}

export function useIssuerOffline(): IssuerOfflineContextValue {
  const ctx = useContext(IssuerOfflineContext);
  if (!ctx) throw new Error('useIssuerOffline must be used inside <IssuerOfflineProvider>');
  return ctx;
}
