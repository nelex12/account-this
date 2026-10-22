// verifyQr.ts — the Issuer's offline checks of a worker's QR, in the order of the project description:
//   1. format (strict AT1)            -> FORMAT
//   2. server signature on the token  -> INVALID_SERVER_SIG
//   3. worker signature               -> INVALID_WORKER_SIG
//   4. issuedAt <= timestamp <= expiresAt -> EXPIRED_TOKEN
//   5. |timestamp − server time| <= 60 s  -> TIME_DRIFT
//   6. this QR is not in the local journal yet -> DUPLICATE
// Any failure = the operation is rejected and nothing is written to the journal.
// Then the (non-blocking) comparison with the local registry: registryWarnings().
import { base64UrlDecode } from './base64url';
import {
  MAX_TIME_DRIFT_SEC,
  operationSignedData,
  parseAt1,
  tokenSignedData,
  type At1Payload,
  type RentalOperation,
  type ToolCondition,
} from './at1';
import { verify } from './ed25519';

export type VerifyFailure =
  | 'FORMAT'
  | 'INVALID_SERVER_SIG'
  | 'INVALID_WORKER_SIG'
  | 'EXPIRED_TOKEN'
  | 'TIME_DRIFT'
  | 'DUPLICATE';

export type VerifyResult =
  | { ok: true; payload: At1Payload }
  | { ok: false; reason: VerifyFailure; message: string; payload?: At1Payload };

export interface VerifyContext {
  /** Server public key saved from GET /api/auth/server-key (32 bytes). */
  serverPublicKey: Uint8Array;
  /** Current server time, Unix seconds (see serverTime.ts). */
  serverNowSec: number;
  /** Has this workerSignature already been seen in the local journal? */
  isDuplicate: (workerSignature: string) => boolean | Promise<boolean>;
}

export const FAILURE_MESSAGES: Record<Exclude<VerifyFailure, 'FORMAT'>, string> = {
  INVALID_SERVER_SIG: 'Подпись сервера неверна: сертификат сотрудника подделан или выдан другой системой',
  INVALID_WORKER_SIG: 'Подпись сотрудника неверна: QR изменён',
  EXPIRED_TOKEN: 'Срок действия сертификата сотрудника истёк',
  TIME_DRIFT: 'Время в QR сильно отличается от текущего. Пусть сотрудник создаст QR заново',
  DUPLICATE: 'Этот QR уже был принят',
};

export async function verifyWorkerQr(qr: string, ctx: VerifyContext): Promise<VerifyResult> {
  const parsed = parseAt1(qr);
  if (!parsed.ok) return { ok: false, reason: 'FORMAT', message: parsed.error };
  const { payload } = parsed;
  const reject = (reason: Exclude<VerifyFailure, 'FORMAT'>): VerifyResult => ({
    ok: false,
    reason,
    message: FAILURE_MESSAGES[reason],
    payload,
  });

  const serverOk = await verify(
    ctx.serverPublicKey,
    tokenSignedData(payload.token),
    base64UrlDecode(payload.serverSignature),
  );
  if (!serverOk) return reject('INVALID_SERVER_SIG');

  // The worker's key comes from the token, which the server signature has just vouched for.
  const workerOk = await verify(
    base64UrlDecode(payload.tokenData.workerPublicKey),
    operationSignedData(payload.token, payload.serverSignature, payload.op),
    base64UrlDecode(payload.workerSignature),
  );
  if (!workerOk) return reject('INVALID_WORKER_SIG');

  const { timestamp } = payload.operation;
  if (timestamp < payload.tokenData.issuedAt || timestamp > payload.tokenData.expiresAt) {
    return reject('EXPIRED_TOKEN');
  }
  if (Math.abs(timestamp - ctx.serverNowSec) > MAX_TIME_DRIFT_SEC) return reject('TIME_DRIFT');
  if (await ctx.isDuplicate(payload.workerSignature)) return reject('DUPLICATE');

  return { ok: true, payload };
}

/* ------------------------- comparison with the registry ------------------------ */

export type RegistryWarning =
  /** No such tool in the local registry (added later by someone else, or written off). */
  | { kind: 'UNKNOWN_TOOL' }
  /** The claimed condition differs from the registry: the Issuer inspects the tool and decides. */
  | { kind: 'CONDITION_MISMATCH'; registered: ToolCondition; claimed: ToolCondition };

/** Not blocking: the Issuer confirms or declines. The server neither repeats nor stores these. */
export function registryWarnings(
  operation: Pick<RentalOperation, 'toolCondition'>,
  registered: { condition: ToolCondition } | undefined,
): RegistryWarning[] {
  if (!registered) return [{ kind: 'UNKNOWN_TOOL' }];
  if (registered.condition !== operation.toolCondition) {
    return [{ kind: 'CONDITION_MISMATCH', registered: registered.condition, claimed: operation.toolCondition }];
  }
  return [];
}
