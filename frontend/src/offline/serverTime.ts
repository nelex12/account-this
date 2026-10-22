// serverTime.ts — "server time" for offline work.
//
// Device clocks can be wrong, so every online response that carries `serverTime`
// (server-key, worker-cert) updates an offset; offline, "server time" = local time + offset.
// The Issuer compares the worker's timestamp with THIS time (limit: 60 s), and stores it
// as `scannedAt`. All values are Unix seconds, the offset is kept in milliseconds.

export interface ClockOffset {
  /** serverTime − local time, milliseconds */
  offsetMs: number;
  /** local Date.now() when the offset was measured */
  measuredAt: number;
}

export function computeOffset(serverTimeSec: number, localNowMs: number = Date.now()): ClockOffset {
  return { offsetMs: serverTimeSec * 1000 - localNowMs, measuredAt: localNowMs };
}

/** Current server time in whole Unix seconds. With no offset yet: the local clock. */
export function serverNowSec(offset: ClockOffset | null, localNowMs: number = Date.now()): number {
  return Math.floor((localNowMs + (offset?.offsetMs ?? 0)) / 1000);
}
