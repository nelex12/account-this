// useWakeLock.ts — keeps the screen on while `active` (the Issuer has to scan the QR; a dimmed phone is useless).
// Not supported everywhere (older Safari): then it silently does nothing.
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        /* denied (battery saver, hidden tab): not critical */
      }
    };
    void acquire();
    // the lock is released by the browser when the tab is hidden: take it again on return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
