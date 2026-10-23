// qrValidity.ts — how long the Worker's QR can be shown.
//
// The Issuer rejects an operation whose timestamp differs from his server time by more than
// MAX_TIME_DRIFT_SEC (60). The screen counts down a bit less than that: scanning takes a moment
// and the two clocks are only synchronized to about a second.
import { MAX_TIME_DRIFT_SEC } from './at1';

export const QR_SAFETY_MARGIN_SEC = 10;
export const QR_SHOWN_FOR_SEC = MAX_TIME_DRIFT_SEC - QR_SAFETY_MARGIN_SEC;

/** Seconds the QR created at `timestamp` can still be shown (<= 0: show "outdated"). */
export function qrSecondsLeft(timestamp: number, serverNowSec: number): number {
  return timestamp + QR_SHOWN_FOR_SEC - serverNowSec;
}
