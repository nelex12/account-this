// meta.ts — small key-value facts: server key, clock offset, offline identity.
import { base64UrlDecode } from './base64url';
import { getDb, type MetaValues } from './db';
import { computeOffset, serverNowSec, type ClockOffset } from './serverTime';

export async function getMeta<K extends keyof MetaValues>(key: K): Promise<MetaValues[K] | undefined> {
  return (await (await getDb()).get('meta', key)) as MetaValues[K] | undefined;
}

export async function setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]): Promise<void> {
  await (await getDb()).put('meta', value, key);
}

export async function deleteMeta(key: keyof MetaValues): Promise<void> {
  await (await getDb()).delete('meta', key);
}

/* ------------------------------- server public key ------------------------------ */

/** Saves GET /api/auth/server-key: the key for offline checks AND the clock offset. */
export async function saveServerKey(response: { serverPublicKey: string; serverTime: number }): Promise<void> {
  if (base64UrlDecode(response.serverPublicKey).length !== 32) {
    throw new Error('server public key must be 32 bytes');
  }
  await setMeta('serverKey', { publicKey: response.serverPublicKey, fetchedAt: Date.now() });
  await saveServerTime(response.serverTime);
}

/** The saved server public key (32 bytes), or null if the Issuer has never been online. */
export async function loadServerPublicKey(): Promise<Uint8Array | null> {
  const saved = await getMeta('serverKey');
  return saved ? base64UrlDecode(saved.publicKey) : null;
}

/* ------------------------------------- clock ------------------------------------ */

/** Call with `serverTime` from every online response that has it. */
export async function saveServerTime(serverTimeSec: number, localNowMs: number = Date.now()): Promise<void> {
  await setMeta('clock', computeOffset(serverTimeSec, localNowMs));
}

export async function loadClockOffset(): Promise<ClockOffset | null> {
  return (await getMeta('clock')) ?? null;
}

/** "Server time" now, Unix seconds, from the saved offset (local clock if none yet). */
export async function getServerNowSec(localNowMs: number = Date.now()): Promise<number> {
  return serverNowSec(await loadClockOffset(), localNowMs);
}

/** True once an offset was measured: before that the local clock is trusted blindly. */
export async function isClockSynced(): Promise<boolean> {
  return (await loadClockOffset()) !== null;
}
