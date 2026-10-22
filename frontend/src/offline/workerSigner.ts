// workerSigner.ts — the Worker's side: certificate from the server -> signed operation QR.
import { base64UrlDecode, base64UrlEncode } from './base64url';
import {
  buildQrString,
  encodeOperation,
  operationSignedData,
  parseToken,
  type RentalOperation,
  type ServerSignedToken,
} from './at1';
import { importSigningKey, sign, type SigningKey } from './ed25519';

/** api.yaml WorkerCertificate: the response of GET /api/auth/worker-cert. */
export interface WorkerCertificateResponse {
  token: string;
  serverSignature: string;
  /** 32-byte seed, base64url */
  temporaryPrivateKey: string;
  serverTime: number;
}

/** What the device keeps (IndexedDB, store `certs`). token/serverSignature are used exactly as received. */
export interface StoredCertificate {
  /** The signed-in worker (the server also puts workerId into the token) */
  userId: string;
  token: string;
  serverSignature: string;
  tokenData: ServerSignedToken;
  signingKey: SigningKey;
  /** Unix seconds, from the token */
  issuedAt: number;
  expiresAt: number;
  /** Local Date.now() when received */
  receivedAt: number;
}

export class CertificateError extends Error {}

/** Validates the server response and builds what is saved on the device. */
export async function createStoredCertificate(
  userId: string,
  response: WorkerCertificateResponse,
  receivedAt: number = Date.now(),
): Promise<StoredCertificate> {
  const parsed = parseToken(response.token);
  if (!parsed.ok) throw new CertificateError(parsed.error);
  const tokenData = parsed.token;
  if (tokenData.workerId !== userId) throw new CertificateError('Сертификат выдан другому сотруднику');

  let signingKey: SigningKey;
  try {
    signingKey = await importSigningKey(
      base64UrlDecode(response.temporaryPrivateKey),
      base64UrlDecode(tokenData.workerPublicKey),
    );
  } catch {
    throw new CertificateError('Сертификат содержит неверный ключ');
  }

  return {
    userId,
    token: response.token,
    serverSignature: response.serverSignature,
    tokenData,
    signingKey,
    issuedAt: tokenData.issuedAt,
    expiresAt: tokenData.expiresAt,
    receivedAt,
  };
}

/** Is the certificate usable at this server time (Unix seconds)? */
export function isCertificateValidAt(cert: Pick<StoredCertificate, 'issuedAt' | 'expiresAt'>, serverNowSec: number): boolean {
  return cert.issuedAt <= serverNowSec && serverNowSec <= cert.expiresAt;
}

/**
 * Builds and signs the operation:
 *   workerSignature = Ed25519(tempKey, "AT1-OP." + token + "." + serverSignature + "." + op)
 * Returns the QR string AT1.<token>.<serverSignature>.<op>.<workerSignature>.
 * `timestamp` = server time (Unix seconds) at this moment.
 */
export async function createOperationQr(
  cert: StoredCertificate,
  operation: Omit<RentalOperation, 'timestamp'>,
  timestamp: number,
): Promise<{ qr: string; workerSignature: string; operation: RentalOperation }> {
  if (!isCertificateValidAt(cert, timestamp)) {
    throw new CertificateError('Сертификат не действует в это время');
  }
  const full: RentalOperation = { ...operation, timestamp };
  const op = encodeOperation(full);
  const signature = await sign(cert.signingKey, operationSignedData(cert.token, cert.serverSignature, op));
  const workerSignature = base64UrlEncode(signature);
  return { qr: buildQrString(cert.token, cert.serverSignature, op, workerSignature), workerSignature, operation: full };
}
