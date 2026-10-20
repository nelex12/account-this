// Types shared by the Worker scan -> operation -> QR flow.
// Values match api.yaml (RentalAction, ToolCondition) so they can go
// straight into RentalOperation when the QR is built.

export type RentalAction = 'TAKE' | 'GIVE';
export type ApiToolCondition = 'Good' | 'Damaged' | 'Broken';

/** What the scanner got out of the tool's sticker. */
export interface ScannedTool {
  /** UUID from the sticker (RentalOperation.toolId) */
  id: string;
  /** Name from the sticker (RentalOperation.toolName) */
  name: string;
  /** Optional inventory number / place, shown as a caption */
  details?: string;
}

/** What the worker chose on the operation page. */
export interface OperationChoice {
  tool: ScannedTool;
  action: RentalAction;
  toolCondition: ApiToolCondition;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Text written into the QR of a tool sticker (the exact inverse of parseToolSticker).
 * Compact JSON {"toolId","toolName"}: the format is defined by the frontend, the server never reads it.
 */
export function buildToolSticker(tool: { id: string; name: string }): string {
  return JSON.stringify({ toolId: tool.id, toolName: tool.name });
}

/**
 * Parses the text of a tool sticker.
 * TODO: the sticker format is not fixed in api.yaml (only "toolId + toolName").
 * Accepted for now: JSON {"toolId","toolName"} or a bare UUID. Adjust here only.
 */
export function parseToolSticker(text: string): ScannedTool | null {
  const raw = text.trim();
  if (UUID_RE.test(raw)) return { id: raw, name: 'Инструмент' };
  try {
    const obj = JSON.parse(raw) as { toolId?: unknown; toolName?: unknown };
    if (typeof obj.toolId === 'string' && UUID_RE.test(obj.toolId) && typeof obj.toolName === 'string') {
      return { id: obj.toolId, name: obj.toolName };
    }
  } catch {
    /* not JSON */
  }
  return null;
}