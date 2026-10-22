// operations.ts — the Worker's own signed operations (store `operations`).
//
// The server learns about an operation only after the Issuer syncs it, so the Worker's
// "tools on hand" list is built from what this device signed (the Issuer may have declined
// some: this is a hint, the server data stays the source of truth once it arrives).
import { getDb, type OwnOperation } from './db';

export async function recordOwnOperation(op: OwnOperation): Promise<void> {
  await (await getDb()).put('operations', op);
}

/** Newest first. */
export async function listOwnOperations(userId: string, limit = 50): Promise<OwnOperation[]> {
  const rows = await (await getDb()).getAllFromIndex('operations', 'by-user', userId);
  return rows.sort((a, b) => b.timestamp - a.timestamp || b.createdAt - a.createdAt).slice(0, limit);
}

export interface HeldTool {
  toolId: string;
  toolName: string;
  /** Server time of the TAKE, Unix seconds */
  since: number;
}

/** Tools whose latest signed operation by this worker is TAKE. */
export async function toolsOnHand(userId: string): Promise<HeldTool[]> {
  const rows = await (await getDb()).getAllFromIndex('operations', 'by-user', userId);
  const latest = new Map<string, OwnOperation>();
  for (const op of rows) {
    const prev = latest.get(op.toolId);
    if (!prev || op.timestamp > prev.timestamp) latest.set(op.toolId, op);
  }
  return [...latest.values()]
    .filter((op) => op.action === 'TAKE')
    .map((op) => ({ toolId: op.toolId, toolName: op.toolName, since: op.timestamp }))
    .sort((a, b) => b.since - a.since);
}
