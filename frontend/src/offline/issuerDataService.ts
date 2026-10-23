// issuerDataService.ts — what the Issuer must download while online to work without internet:
//   1. the server's public key (GET /api/auth/server-key): without it no QR can be verified;
//      the response also carries serverTime, which corrects the clock offset;
//   2. the tools registry (GET /api/tools) into the local registry.
// The two are independent: one failing does not stop the other. No React here.
import type { Tool } from '../entities/toolsModel';
import { getMeta, loadServerPublicKey, saveServerKey } from './meta';
import { replaceRegistry } from './registry';

export interface RefreshOptions {
  issuerId: string;
  fetchServerKey: () => Promise<{ serverPublicKey: string; serverTime: number }>;
  fetchTools: () => Promise<Tool[]>;
  /** navigator.onLine. false = do not try */
  online?: boolean;
  nowMs?: number;
}

export type StepResult = 'ok' | 'failed' | 'skipped';

export async function refreshIssuerData(options: RefreshOptions): Promise<{ serverKey: StepResult; registry: StepResult }> {
  const { issuerId, fetchServerKey, fetchTools, online = true, nowMs = Date.now() } = options;
  if (!online) return { serverKey: 'skipped', registry: 'skipped' };

  let serverKey: StepResult = 'ok';
  try {
    await saveServerKey(await fetchServerKey());
  } catch {
    serverKey = 'failed';
  }

  let registry: StepResult = 'ok';
  try {
    await replaceRegistry(issuerId, await fetchTools(), nowMs);
  } catch {
    registry = 'failed';
  }
  return { serverKey, registry };
}

export interface IssuerDataStatus {
  /** The server key is saved: QR codes can be verified offline */
  hasServerKey: boolean;
  /** Unix ms of the last registry download for this issuer, null = never */
  registryFetchedAt: number | null;
}

export async function readIssuerDataStatus(issuerId: string): Promise<IssuerDataStatus> {
  const registry = await getMeta('registry');
  return {
    hasServerKey: (await loadServerPublicKey()) !== null,
    registryFetchedAt: registry && registry.ownerUserId === issuerId ? registry.fetchedAt : null,
  };
}
