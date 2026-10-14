// src/entities/toolsModel.ts

/**
 * Mirrors api.yaml exactly.
 *
 * Rules from the spec that shape the UI:
 *  - condition is one of Good | Damaged | Broken (severity order), casing matters;
 *  - a tool has no "number", "category" or "location" — only a holder;
 *  - isActive = false means written off (irreversible, DELETE only);
 *  - holderId = null means "at the storekeeper", not "not issued yet".
 */

/** api.yaml ToolCondition. Severity: Good < Damaged < Broken. */
export type ToolCondition = 'Good' | 'Damaged' | 'Broken';

/** api.yaml Tool — item of GET /api/tools and GET /api/tools/{id}. */
export interface Tool {
  /** UUID assigned by the DB; the QR label is printed with this id. */
  id: string;
  name: string;
  condition: ToolCondition;
  /** Set only via PATCH /api/tools/{id}; null = no comment. */
  comment: string | null;
  /** false = written off. Never becomes true again. */
  isActive: boolean;
  /** Employee currently holding the tool; null = at the storekeeper. */
  holderId: string | null;
  /** FIO of the holder (from users); null when holderId is null. */
  holderName: string | null;
  /** Unix seconds of the TAKE operation that gave the tool to the holder. */
  heldSince: number | null;
}

/** api.yaml CreateToolRequest. The server always creates Good / no comment / no holder. */
export interface CreateToolRequest {
  /** Max 100 chars — it is embedded in the employee's QR. */
  name: string;
}

/**
 * api.yaml UpdateToolConditionRequest.
 * Absent or null field = unchanged. comment: "" clears the comment.
 * Changing `condition` also bumps the tool's condition-changed timestamp
 * server-side, so older offline operations no longer overwrite it.
 */
export interface UpdateToolConditionRequest {
  condition?: ToolCondition | null;
  comment?: string | null;
}

/* --------------------------------- helpers --------------------------------- */

/** The tool is currently with an employee (vs. on the shelf). */
export function isIssued(tool: Tool): boolean {
  return tool.holderId !== null;
}

/** Needs attention: Damaged or Broken. */
export function isFaulty(tool: Tool): boolean {
  return tool.condition !== 'Good';
}

/** Human-readable "where is it" line for tables and cards. */
export function getToolLocation(tool: Tool): string {
  return isIssued(tool)
    ? `На руках · ${tool.holderName ?? '—'}`
    : 'На месте';
}

/**
 * Unix seconds -> "DD.MM.YYYY HH:MM" in the local timezone.
 * Server always sends UTC seconds; Date converts to local for display.
 */
export function formatUnix(seconds: number): string {
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}