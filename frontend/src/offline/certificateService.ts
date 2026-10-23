// certificateService.ts — keeps the Worker's certificate fresh: the rules, with no React in it.
//
// A certificate lives 12 hours. The Worker needs one to make QR codes without internet, so:
//   - no usable certificate            -> fetch one (online) or report "missing" (offline);
//   - less than RENEW_WHEN_LEFT_SEC left -> fetch a new one while online (the old one stays valid until it expires);
//   - 403 (fired / not approved)       -> the stored certificate is deleted, nothing can be signed.
import { deleteCertificate, getCertificate, saveCertificate } from './certs';
import { getServerNowSec, saveServerTime } from './meta';
import {
  CertificateError,
  createStoredCertificate,
  isCertificateValidAt,
  type StoredCertificate,
  type WorkerCertificateResponse,
} from './workerSigner';

/** Renew when fewer than this many seconds are left (a long shift must not start with a short certificate). */
export const RENEW_WHEN_LEFT_SEC = 6 * 3600;

/** Why a certificate could not be fetched. Thrown by the API layer. */
export class CertificateFetchError extends Error {
  readonly kind: 'forbidden' | 'network' | 'server';
  constructor(kind: 'forbidden' | 'network' | 'server', message: string) {
    super(message);
    this.kind = kind;
  }
}

export type CertificateState =
  | { status: 'ready'; cert: StoredCertificate; refreshed: boolean }
  /** Nothing usable and no way to fetch (offline) */
  | { status: 'missing' }
  /** The server refuses: account not approved or deactivated */
  | { status: 'forbidden'; message: string }
  | { status: 'error'; message: string };

export interface EnsureOptions {
  userId: string;
  fetchCertificate: () => Promise<WorkerCertificateResponse>;
  /** Ignore the stored certificate's remaining lifetime and fetch a new one (if online) */
  force?: boolean;
  /** navigator.onLine. false = do not even try */
  online?: boolean;
  /** Local clock, ms (tests) */
  nowMs?: number;
}

export async function ensureCertificate(options: EnsureOptions): Promise<CertificateState> {
  const { userId, fetchCertificate, force = false, online = true, nowMs = Date.now() } = options;

  const serverNow = await getServerNowSec(nowMs);
  const stored = await getCertificate(userId);
  const usable = stored && isCertificateValidAt(stored, serverNow) ? stored : undefined;

  const needsNew = force || !usable || usable.expiresAt - serverNow < RENEW_WHEN_LEFT_SEC;
  if (!needsNew) return { status: 'ready', cert: usable, refreshed: false };

  const fallback = (): CertificateState =>
    usable ? { status: 'ready', cert: usable, refreshed: false } : { status: 'missing' };

  if (!online) return fallback();

  try {
    const response = await fetchCertificate();
    const cert = await createStoredCertificate(userId, response, nowMs);
    await saveCertificate(cert);
    await saveServerTime(response.serverTime, nowMs); // the response also corrects the clock offset
    return { status: 'ready', cert, refreshed: true };
  } catch (e) {
    if (e instanceof CertificateFetchError) {
      if (e.kind === 'forbidden') {
        await deleteCertificate(userId);
        return { status: 'forbidden', message: e.message };
      }
      if (e.kind === 'network') return fallback();
      return usable ? fallback() : { status: 'error', message: e.message };
    }
    if (e instanceof CertificateError) return usable ? fallback() : { status: 'error', message: e.message };
    throw e;
  }
}
