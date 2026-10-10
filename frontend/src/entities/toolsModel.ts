
export type ToolCondition = 'ok' | 'broken' | 'inspection' | 'damaged';
export interface Tool {
  id: string;
  name: string;
  number: string;
  category: string;
  condition: ToolCondition;
  location: string;
  updatedAt: number;      // unix seconds, as in your spec
  issuedTo: string | null; // replaces `issued: boolean` and the string "На руках · …"
}

export interface ToolRow {
  id: string;
  name: string;
  number: string;
  category: string;
  condition: ToolCondition;
  location: string;
  updated: string;
  /** true when the tool is currently with an employee */
  issued: boolean;
}

