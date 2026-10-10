/* ----------------------------------- Types ---------------------------------- */

export type JournalAction = 'issue' | 'return';
export type JournalFilter = 'all' | JournalAction;

export interface JournalRow {
  id: string;
  time: string;
  action: JournalAction;
  toolName: string;
  toolNumber: string;
  employee: string;
  /** Condition declared by the employee */
  declared: string;
  /** Who accepted the operation ("—" if nobody yet) */
  acceptedBy: string;
}