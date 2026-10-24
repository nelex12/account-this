// db.ts — the app's IndexedDB (library: idb). One database, opened once.
//
// Stores
//   meta        key-value: server public key, clock offset, offline identity, last sync, registry owner
//   certs       Worker: the temporary certificate + signing key, one per user
//   tools       Issuer: the local registry (snapshot of GET /api/tools + local operations on top)
//   journal     Issuer: scanned QRs. Records are never edited, only their send status
//   operations  Worker: operations this worker signed (to show "tools on hand" offline)
//
// Schema changes = a new `version` + a new `if (oldVersion < N)` block in upgrade().
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ValidationFlag } from '../entities/journalModel';
import type { Tool } from '../entities/toolsModel';
import type { RentalAction, ToolCondition } from './at1';
import type { StoredCertificate } from './workerSigner';

export const DB_NAME = 'account-this';
export const DB_VERSION = 1;

/** Registry entry: the server's Tool + the time of the last LOCAL operation applied to it. */
export type LocalTool = Tool & { localOpAt?: number };

export type JournalStatus = 'pending' | 'sent' | 'quarantined';

export interface JournalEntry {
  /** Local auto-increment: scan order */
  id?: number;
  /** The issuer who scanned (the server takes issuer_id from the JWT, so only he may sync it) */
  userId: string;
  /** The QR exactly as scanned */
  qr: string;
  /** Server time of the scan, Unix seconds */
  scannedAt: number;
  /** Copy of the QR's workerSignature, for the duplicate check */
  workerSignature: string;
  status: JournalStatus;
  /** Local Date.now() */
  createdAt: number;
  /** After sync: the server's verdict and log id */
  validationFlag?: ValidationFlag;
  logId?: number;
  sentAt?: number;
  /** Set aside because the server rejected its format ("[n].qr") */
  quarantineReason?: string;
}

export interface OwnOperation {
  /** Primary key: unique per signed operation */
  workerSignature: string;
  userId: string;
  qr: string;
  toolId: string;
  toolName: string;
  action: RentalAction;
  toolCondition: ToolCondition;
  /** Server time, Unix seconds */
  timestamp: number;
  createdAt: number;
}

export interface MetaValues {
  serverKey: { publicKey: string; fetchedAt: number };
  clock: { offsetMs: number; measuredAt: number };
  /** Who was signed in last: lets the app open offline (no secrets here) */
  identity: {
    userId: string;
    role: 'Owner' | 'Issuer' | 'Worker';
    fullName: string;
    /** Added later: older records have none */
    companyId?: string;
    savedAt: number;
  };
  /** The user pressed "logout" with no network: the server-side session (refresh cookie) is still alive */
  pendingLogout: true;
  /** Whose company the `tools` store belongs to */
  registry: { ownerUserId: string; fetchedAt: number };
  /** Unix seconds of the last successful POST /api/sync, per issuer id */
  lastSyncAt: Record<string, number>;
}

interface AtSchema extends DBSchema {
  meta: { key: keyof MetaValues; value: MetaValues[keyof MetaValues] };
  certs: { key: string; value: StoredCertificate };
  tools: { key: string; value: LocalTool };
  journal: {
    key: number;
    value: JournalEntry;
    indexes: {
      'by-user-status': [string, JournalStatus];
      /** unique: one QR once per issuer */
      'by-user-signature': [string, string];
    };
  };
  operations: {
    key: string;
    value: OwnOperation;
    indexes: { 'by-user': string };
  };
}

export type AtDb = IDBPDatabase<AtSchema>;

let dbPromise: Promise<AtDb> | null = null;

export function getDb(): Promise<AtDb> {
  dbPromise ??= openDB<AtSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('certs', { keyPath: 'userId' });
        db.createObjectStore('tools', { keyPath: 'id' });

        const journal = db.createObjectStore('journal', { keyPath: 'id', autoIncrement: true });
        journal.createIndex('by-user-status', ['userId', 'status']);
        journal.createIndex('by-user-signature', ['userId', 'workerSignature'], { unique: true });

        const operations = db.createObjectStore('operations', { keyPath: 'workerSignature' });
        operations.createIndex('by-user', 'userId');
      }
    },
    blocked() {
      console.warn('IndexedDB upgrade is blocked by another tab');
    },
    terminated() {
      dbPromise = null; // the browser closed the connection: reopen on the next call
    },
  });
  return dbPromise;
}

/** Closes the connection (tests, and before deleting the database). */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}
