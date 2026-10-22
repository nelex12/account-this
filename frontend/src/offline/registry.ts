// registry.ts — the Issuer's local tools registry (store `tools`).
//
// Loaded from GET /api/tools while online. Operations the Issuer confirms offline are applied
// on top (condition + holder) so the registry stays right until they are synced. The server only
// knows synced operations, so after every reload the still-pending ones are applied again.
import type { Tool } from '../entities/toolsModel';
import { parseAt1, type RentalOperation, type ServerSignedToken } from './at1';
import { getDb, type LocalTool } from './db';

/** Applies one confirmed operation to a registry entry. An older operation never overwrites a newer one. */
export function applyOperationToTool(
  tool: LocalTool,
  operation: RentalOperation,
  token: Pick<ServerSignedToken, 'workerId' | 'fio'>,
): LocalTool {
  if (operation.timestamp < (tool.localOpAt ?? 0)) return tool;
  const take = operation.action === 'TAKE';
  return {
    ...tool,
    condition: operation.toolCondition,
    holderId: take ? token.workerId : null,
    holderName: take ? token.fio : null,
    heldSince: take ? operation.timestamp : null,
    localOpAt: operation.timestamp,
  };
}

/**
 * Replaces the registry with a fresh download and re-applies this issuer's pending operations.
 * One transaction: a crash cannot leave a half-replaced registry.
 */
export async function replaceRegistry(
  ownerUserId: string,
  tools: Tool[],
  fetchedAt: number = Date.now(),
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['tools', 'journal', 'meta'], 'readwrite');
  const store = tx.objectStore('tools');
  await store.clear();

  const byId = new Map<string, LocalTool>(tools.map((t) => [t.id, { ...t }]));

  const pending = await tx.objectStore('journal').index('by-user-status').getAll([ownerUserId, 'pending']);
  const operations = pending.flatMap((entry) => {
    const parsed = parseAt1(entry.qr);
    return parsed.ok ? [parsed.payload] : [];
  });
  operations.sort((a, b) => a.operation.timestamp - b.operation.timestamp);
  for (const { operation, tokenData } of operations) {
    const tool = byId.get(operation.toolId);
    if (tool) byId.set(tool.id, applyOperationToTool(tool, operation, tokenData));
  }

  for (const tool of byId.values()) await store.put(tool);
  await tx.objectStore('meta').put({ ownerUserId, fetchedAt }, 'registry');
  await tx.done;
}

export async function listTools(): Promise<LocalTool[]> {
  return (await getDb()).getAll('tools');
}

export async function getTool(id: string): Promise<LocalTool | undefined> {
  return (await getDb()).get('tools', id);
}

/** Wipes the registry (another company's user signed in on this device). */
export async function clearRegistry(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['tools', 'meta'], 'readwrite');
  await tx.objectStore('tools').clear();
  await tx.objectStore('meta').delete('registry');
  await tx.done;
}
