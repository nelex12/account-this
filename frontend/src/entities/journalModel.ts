// journalModel.ts
// Two layers:
//   1. RentalLogEntry — exactly what GET /api/logs returns (api.yaml, schema RentalLogEntry).
//   2. JournalRow     — what the journal screens render, built from (1) by toJournalRow().
// Screens must not read RentalLogEntry directly.

/* ------------------------------- API (api.yaml) ------------------------------ */

export type RentalAction = 'TAKE' | 'GIVE';
export type ToolConditionApi = 'Good' | 'Damaged' | 'Broken';

export type ValidationFlag =
  | 'VALID'
  | 'INVALID_SERVER_SIG'
  | 'INVALID_WORKER_SIG'
  | 'EXPIRED_TOKEN'
  | 'TIME_DRIFT'
  | 'UNKNOWN_WORKER'
  | 'WORKER_DEACTIVATED'
  | 'UNKNOWN_TOOL'
  | 'DUPLICATE';

/** One item of GET /api/logs. All times are Unix seconds (UTC). */
export interface RentalLogEntry {
  id: number; // int32, not a UUID
  /** null when the tool is unknown / not verified (UNKNOWN_TOOL, bad signatures) */
  toolId: string | null;
  toolName: string;
  /** null when the worker is unknown / not verified */
  workerId: string | null;
  workerName: string;
  /** Issuer who synced the record. There is no issuer name in the response. */
  issuerId: string;
  action: RentalAction;
  toolCondition: ToolConditionApi;
  /** Time of the operation (from the worker's QR) */
  qrTimestamp: number;
  /** Time the issuer scanned the QR */
  scannedAt: number;
  validationFlag: ValidationFlag;
  /** Time the record was saved on the server (sync time) */
  createdAt: number;
}

/* ------------------------------ UI view model ------------------------------- */

/** UI wording: TAKE = "Выдача" (issue), GIVE = "Возврат" (return). */
export type JournalAction = 'issue' | 'return';
export type JournalFilter = 'all' | JournalAction;

export type ConditionColor = 'success' | 'warning' | 'error';

export interface Condition {
  label: string;
  color: ConditionColor;
}

export interface Validation {
  flag: ValidationFlag;
  label: string;
  color: ConditionColor;
}

export interface JournalRow {
  /** RentalLogEntry.id */
  id: number;
  /** Operation time, formatted "dd.MM.yyyy HH:mm" in the user's time zone */
  time: string;
  /** Operation time, Unix seconds (for sorting / details) */
  timestamp: number;
  action: JournalAction;
  toolName: string;
  /** null — tool is not in the company registry */
  toolId: string | null;
  /** Worker name from the log (the verified one if known, else as claimed in the QR) */
  employee: string;
  /** Condition declared by the employee */
  condition: Condition;
  /** Result of the server-side check */
  validation: Validation;
}

/* --------------------------------- Mapping ---------------------------------- */

export const actionToApi: Record<JournalAction, RentalAction> = {
  issue: 'TAKE',
  return: 'GIVE',
};

const actionFromApi: Record<RentalAction, JournalAction> = {
  TAKE: 'issue',
  GIVE: 'return',
};

export const conditionFromApi: Record<ToolConditionApi, Condition> = {
  Good: { label: 'Исправен', color: 'success' },
  Damaged: { label: 'Поврежден', color: 'warning' },
  Broken: { label: 'Сломан', color: 'error' },
};

export const validationLabels: Record<ValidationFlag, { label: string; color: ConditionColor }> = {
  VALID: { label: 'Проверено', color: 'success' },
  INVALID_SERVER_SIG: { label: 'Неверная подпись сервера', color: 'error' },
  INVALID_WORKER_SIG: { label: 'Неверная подпись сотрудника', color: 'error' },
  EXPIRED_TOKEN: { label: 'Сертификат истёк', color: 'error' },
  TIME_DRIFT: { label: 'Расхождение времени', color: 'warning' },
  UNKNOWN_WORKER: { label: 'Неизвестный сотрудник', color: 'error' },
  WORKER_DEACTIVATED: { label: 'Сотрудник уволен', color: 'error' },
  UNKNOWN_TOOL: { label: 'Неизвестный инструмент', color: 'error' },
  DUPLICATE: { label: 'Повторный QR', color: 'warning' },
};

/** Unix seconds -> "02.10.2026 16:42" (local time zone). */
export function formatUnix(seconds: number): string {
  return new Date(seconds * 1000)
    .toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(', ', ' ');
}

export function toJournalRow(entry: RentalLogEntry): JournalRow {
  return {
    id: entry.id,
    time: formatUnix(entry.qrTimestamp),
    timestamp: entry.qrTimestamp,
    action: actionFromApi[entry.action],
    toolName: entry.toolName,
    toolId: entry.toolId,
    employee: entry.workerName,
    condition: conditionFromApi[entry.toolCondition],
    validation: { flag: entry.validationFlag, ...validationLabels[entry.validationFlag] },
  };
}