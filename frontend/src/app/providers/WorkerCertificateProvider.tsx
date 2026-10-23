// WorkerCertificateProvider.tsx — keeps the Worker's certificate fresh in the background.
//
// Runs the rules of offline/certificateService.ts: on app start, when the connection comes back,
// when the app returns to the foreground, and every few minutes. Pages read the state with
// useWorkerCertificate(); the QR page calls `ensure()` right before it signs.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchWorkerCertificate } from '../../api/workerCert';
import { ensureCertificate, type CertificateState } from '../../offline/certificateService';
import { useAuth } from './AuthProvider';

export type CertificateView = { status: 'loading' } | CertificateState;

interface WorkerCertificateContextValue {
  view: CertificateView;
  /** Re-checks (and renews when needed). Resolves with the result. `force` = get a new one if online. */
  ensure: (force?: boolean) => Promise<CertificateState>;
}

const WorkerCertificateContext = createContext<WorkerCertificateContextValue | null>(null);

const RECHECK_MS = 5 * 60_000;

export function WorkerCertificateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [view, setView] = useState<CertificateView>({ status: 'loading' });
  const running = useRef<Promise<CertificateState> | null>(null);

  const ensure = useCallback(
    (force = false): Promise<CertificateState> => {
      if (!userId) return Promise.resolve({ status: 'missing' });
      // one check at a time; a forced one waits for the running one and then runs again
      const previous = running.current ?? Promise.resolve(undefined);
      const next = previous
        .catch(() => undefined)
        .then(() =>
          ensureCertificate({
            userId,
            fetchCertificate: fetchWorkerCertificate,
            force,
            online: navigator.onLine,
          }),
        )
        .then((state) => {
          setView(state);
          return state;
        });
      running.current = next;
      void next.finally(() => {
        if (running.current === next) running.current = null;
      });
      return next;
    },
    [userId],
  );

  useEffect(() => {
    void ensure().catch(() => setView({ status: 'error', message: 'Не удалось проверить сертификат' }));
    const recheck = () => void ensure().catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('online', recheck);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(recheck, RECHECK_MS);
    return () => {
      window.removeEventListener('online', recheck);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [ensure]);

  const value = useMemo(() => ({ view, ensure }), [view, ensure]);
  return <WorkerCertificateContext.Provider value={value}>{children}</WorkerCertificateContext.Provider>;
}

export function useWorkerCertificate(): WorkerCertificateContextValue {
  const ctx = useContext(WorkerCertificateContext);
  if (!ctx) throw new Error('useWorkerCertificate must be used inside <WorkerCertificateProvider>');
  return ctx;
}
