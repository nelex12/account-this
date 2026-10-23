// issuerScan.ts — what happens when the Issuer's camera reads a text, up to the "Confirm" screen.
//
//   not an AT1 string                 -> 'foreign'   (some other QR code)
//   no server public key saved yet    -> 'noKey'     (the Issuer has never been online)
//   any of the 6 checks fails         -> 'rejected'  (nothing is written, the Worker makes a new QR)
//   everything passes                 -> 'accepted'  (+ warnings from comparing with the local registry)
// Confirming is a separate step: journal.confirmOperation().
import type { At1Payload } from './at1';
import type { LocalTool } from './db';
import { hasWorkerSignature } from './journal';
import { getServerNowSec, loadServerPublicKey } from './meta';
import { getTool } from './registry';
import { registryWarnings, verifyWorkerQr, type RegistryWarning, type VerifyFailure } from './verifyQr';

export type ScanOutcome =
  | { kind: 'foreign' }
  | { kind: 'noKey' }
  | { kind: 'rejected'; reason: VerifyFailure; message: string }
  | {
      kind: 'accepted';
      payload: At1Payload;
      /** Server time of the scan: it is what the journal stores as `scannedAt` */
      scannedAt: number;
      warnings: RegistryWarning[];
      /** The tool as the local registry knows it (undefined = not in the registry) */
      tool: LocalTool | undefined;
    };

export type AcceptedScan = Extract<ScanOutcome, { kind: 'accepted' }>;

export async function checkWorkerQr(text: string, issuerId: string): Promise<ScanOutcome> {
  const qr = text.trim();
  if (!qr.startsWith('AT1.')) return { kind: 'foreign' };

  const serverPublicKey = await loadServerPublicKey();
  if (!serverPublicKey) return { kind: 'noKey' };

  const scannedAt = await getServerNowSec();
  const result = await verifyWorkerQr(qr, {
    serverPublicKey,
    serverNowSec: scannedAt,
    isDuplicate: (signature) => hasWorkerSignature(issuerId, signature),
  });
  if (!result.ok) return { kind: 'rejected', reason: result.reason, message: result.message };

  const tool = await getTool(result.payload.operation.toolId);
  return {
    kind: 'accepted',
    payload: result.payload,
    scannedAt,
    warnings: registryWarnings(result.payload.operation, tool),
    tool,
  };
}
