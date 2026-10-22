// Builds QR strings for tests with the app's own signing code (the golden vector is tested separately).
import { base64UrlDecode, base64UrlEncode, base64UrlEncodeText } from '../base64url';
import { buildQrString, encodeOperation, operationSignedData, tokenSignedData, type RentalOperation } from '../at1';
import { importSigningKey, sign } from '../ed25519';
import { VECTOR } from './fixtures';

export const SERVER_PUBLIC_KEY = base64UrlDecode(VECTOR.serverPublicKey);
export const WORKER_ID = '5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21';
export const TOOL_ID = '17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35';

export interface ForgeOptions {
  /** seed of the key that signs the token (default: the real test server key) */
  serverSeed?: string;
  /** seed of the worker's temporary key */
  workerSeed?: string;
  workerId?: string;
  issuedAt?: number;
  expiresAt?: number;
  operation?: Partial<RentalOperation>;
}

/** A correctly signed QR, with any field changed. Defaults match the golden vector's operation. */
export async function forgeQr(options: ForgeOptions = {}): Promise<string> {
  const serverSeed = base64UrlDecode(options.serverSeed ?? VECTOR.serverSeed);
  const workerSeed = base64UrlDecode(options.workerSeed ?? VECTOR.workerSeed);
  const { ed25519 } = await import('@noble/curves/ed25519.js');
  const workerPublic = ed25519.getPublicKey(workerSeed);
  const serverKey = await importSigningKey(serverSeed, ed25519.getPublicKey(serverSeed));
  const workerKey = await importSigningKey(workerSeed, workerPublic);

  const token = base64UrlEncodeText(
    JSON.stringify({
      workerId: options.workerId ?? WORKER_ID,
      fio: 'Иванов Иван Иванович',
      issuedAt: options.issuedAt ?? 1790000000,
      expiresAt: options.expiresAt ?? 1790043200,
      workerPublicKey: base64UrlEncode(workerPublic),
    }),
  );
  const serverSignature = base64UrlEncode(await sign(serverKey, tokenSignedData(token)));
  const op = encodeOperation({
    action: 'TAKE',
    toolCondition: 'Good',
    toolId: TOOL_ID,
    toolName: 'Дрель Bosch',
    timestamp: 1790003600,
    ...options.operation,
  });
  const workerSignature = base64UrlEncode(await sign(workerKey, operationSignedData(token, serverSignature, op)));
  return buildQrString(token, serverSignature, op, workerSignature);
}

/** Replaces one dot-separated part (1 = token ... 4 = workerSignature). */
export function withPart(qr: string, index: 1 | 2 | 3 | 4, value: string): string {
  const parts = qr.split('.');
  parts[index] = value;
  return parts.join('.');
}
