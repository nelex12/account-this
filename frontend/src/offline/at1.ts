// at1.ts — the AT1 QR protocol (see "Формат QR и подписей" in the project description and
// OfflineRentalPayload in api.yaml).
//
//   AT1.<token>.<serverSignature>.<op>.<workerSignature>
//
// This module is pure (no crypto, no storage): strict parsing identical to the backend's
// QrPayloadParser, and the helpers that build the signed strings. A QR that this parser
// rejects is also rejected by POST /api/sync with a 400, so the Issuer must never accept it.
import type { ApiToolCondition, RentalAction } from '../entities/operationModel';
import {
  base64UrlDecode,
  base64UrlEncodeText,
  isBase64Url,
  utf8DecodeStrict,
} from './base64url';

export const AT1_VERSION = 'AT1';
/** The server signs TOKEN_SIGNATURE_PREFIX + token. */
export const TOKEN_SIGNATURE_PREFIX = 'AT1-TOKEN.';
/** The worker signs OPERATION_SIGNATURE_PREFIX + token + "." + serverSignature + "." + op. */
export const OPERATION_SIGNATURE_PREFIX = 'AT1-OP.';
export const SIGNATURE_LENGTH = 64;
export const PUBLIC_KEY_LENGTH = 32;
/** The Issuer accepts an operation only if |timestamp − server time| <= this. */
export const MAX_TIME_DRIFT_SEC = 60;

export type { RentalAction };
export type ToolCondition = ApiToolCondition;

/** api.yaml ServerSignedToken. */
export interface ServerSignedToken {
  workerId: string;
  fio: string;
  issuedAt: number;
  expiresAt: number;
  /** base64url, 32 bytes */
  workerPublicKey: string;
}

/** api.yaml RentalOperation. */
export interface RentalOperation {
  action: RentalAction;
  toolCondition: ToolCondition;
  toolId: string;
  toolName: string;
  timestamp: number;
}

export interface At1Payload {
  /** The whole string exactly as scanned. */
  qr: string;
  /** Raw parts: signatures are checked over these strings, JSON is never re-serialized. */
  token: string;
  serverSignature: string;
  op: string;
  workerSignature: string;
  tokenData: ServerSignedToken;
  operation: RentalOperation;
}

export type ParseResult = { ok: true; payload: At1Payload } | { ok: false; error: string };

const ERROR_PREFIX = 'Строка не соответствует формату AT1: ';

class FormatError extends Error {}
const fail = (message: string): never => {
  throw new FormatError(message);
};

/* ------------------------------ signed strings ------------------------------ */

export const tokenSignedData = (token: string): string => TOKEN_SIGNATURE_PREFIX + token;

export const operationSignedData = (token: string, serverSignature: string, op: string): string =>
  `${OPERATION_SIGNATURE_PREFIX}${token}.${serverSignature}.${op}`;

export const buildQrString = (
  token: string,
  serverSignature: string,
  op: string,
  workerSignature: string,
): string => `${AT1_VERSION}.${token}.${serverSignature}.${op}.${workerSignature}`;

/** op = base64url(UTF-8 JSON RentalOperation). Field order is fixed only for readability. */
export function encodeOperation(operation: RentalOperation): string {
  const { action, toolCondition, toolId, toolName, timestamp } = operation;
  return base64UrlEncodeText(JSON.stringify({ action, toolCondition, toolId, toolName, timestamp }));
}

/* --------------------------------- JSON rules -------------------------------- */

/**
 * JSON.parse cannot see duplicate keys or whether a number was written as 1.0 / 1e3,
 * but the server rejects both. Scans the TOP level of an already valid JSON text for them.
 */
function scanTopLevel(text: string): { duplicates: Set<string>; rawNumbers: Map<string, string> } {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const rawNumbers = new Map<string, string>();
  const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const literal = text.slice(i, j + 1);
      i = j + 1;
      if (depth === 1) {
        let k = i;
        while (k < text.length && isSpace(text[k])) k++;
        if (text[k] === ':') {
          const key = JSON.parse(literal) as string;
          if (seen.has(key)) duplicates.add(key);
          seen.add(key);
          let v = k + 1;
          while (v < text.length && isSpace(text[v])) v++;
          if (text[v] === '-' || (text[v] >= '0' && text[v] <= '9')) {
            let e = v;
            while (e < text.length && text[e] !== ',' && text[e] !== '}' && !isSpace(text[e])) e++;
            rawNumbers.set(key, text.slice(v, e));
          }
          i = k + 1;
        }
      }
      continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    i++;
  }
  return { duplicates, rawNumbers };
}

function parseJsonObject(base64urlPart: string, name: string) {
  let text: string;
  try {
    text = utf8DecodeStrict(base64UrlDecode(base64urlPart));
  } catch {
    return fail(`${name} не является UTF-8 JSON`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(`${name} не является UTF-8 JSON`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(`${name} должен быть JSON-объектом`);
  }
  const { duplicates, rawNumbers } = scanTopLevel(text);
  return { object: value as Record<string, unknown>, duplicates, rawNumbers, name };
}

type JsonObject = NonNullable<ReturnType<typeof parseJsonObject>>;

function field(json: JsonObject, key: string): unknown {
  if (json.duplicates.has(key)) fail(`поле ${json.name}.${key} указано больше одного раза`);
  if (!Object.hasOwn(json.object, key)) fail(`нет обязательного поля ${json.name}.${key}`);
  return json.object[key];
}

function getString(json: JsonObject, key: string): string {
  const value = field(json, key);
  if (typeof value !== 'string') fail(`поле ${json.name}.${key} должно быть строкой`);
  return value as string;
}

/** Integer = JSON number without fraction or exponent (1.0 and 1e3 are rejected). */
function getInteger(json: JsonObject, key: string): number {
  const value = field(json, key);
  const raw = json.rawNumbers.get(key) ?? '';
  if (typeof value !== 'number' || !/^-?(0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(value)) {
    fail(`поле ${json.name}.${key} должно быть целым числом`);
  }
  return value as number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getUuid(json: JsonObject, key: string): string {
  const value = getString(json, key);
  if (!UUID_RE.test(value)) {
    fail(`поле ${json.name}.${key} должно быть UUID в каноническом виде (строчные hex, 8-4-4-4-12)`);
  }
  return value;
}

function getEnum<T extends string>(json: JsonObject, key: string, allowed: readonly T[]): T {
  const value = getString(json, key);
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`поле ${json.name}.${key} должно быть одним из: ${allowed.join(', ')}`);
  }
  return value as T;
}

/* ---------------------------------- parsing ---------------------------------- */

function decodePart(value: string, name: string): Uint8Array {
  if (!isBase64Url(value)) fail(`${name} должен быть в base64url без паддинга`);
  return base64UrlDecode(value);
}

function parseTokenOrThrow(token: string): ServerSignedToken {
  const json = parseJsonObject(token, 'token');
  const data: ServerSignedToken = {
    workerId: getUuid(json, 'workerId'),
    fio: getString(json, 'fio'),
    issuedAt: getInteger(json, 'issuedAt'),
    expiresAt: getInteger(json, 'expiresAt'),
    workerPublicKey: getString(json, 'workerPublicKey'),
  };
  if (decodePart(data.workerPublicKey, 'workerPublicKey').length !== PUBLIC_KEY_LENGTH) {
    fail(`workerPublicKey должен быть ${PUBLIC_KEY_LENGTH} байта`);
  }
  return data;
}

function parseOperationOrThrow(op: string): RentalOperation {
  const json = parseJsonObject(op, 'op');
  return {
    action: getEnum(json, 'action', ['TAKE', 'GIVE'] as const),
    toolCondition: getEnum(json, 'toolCondition', ['Good', 'Damaged', 'Broken'] as const),
    toolId: getUuid(json, 'toolId'),
    toolName: getString(json, 'toolName'),
    timestamp: getInteger(json, 'timestamp'),
  };
}

function wrap<T>(run: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    if (e instanceof FormatError) return { ok: false, error: ERROR_PREFIX + e.message };
    throw e;
  }
}

/** Strict parsing of the whole QR string. Signatures are NOT checked here. */
export function parseAt1(qr: string): ParseResult {
  const result = wrap((): At1Payload => {
    const parts = qr.split('.');
    if (parts.length !== 5) fail('ожидается 5 частей через точку');
    if (parts[0] !== AT1_VERSION) fail(`первая часть должна быть ${AT1_VERSION}`);
    const [, token, serverSignature, op, workerSignature] = parts;
    // decode every part first: same error order as the server
    for (const [value, name] of [
      [token, 'token'],
      [serverSignature, 'serverSignature'],
      [op, 'op'],
      [workerSignature, 'workerSignature'],
    ] as const) {
      decodePart(value, name);
    }
    if (base64UrlDecode(serverSignature).length !== SIGNATURE_LENGTH) {
      fail(`serverSignature должна быть ${SIGNATURE_LENGTH} байта`);
    }
    if (base64UrlDecode(workerSignature).length !== SIGNATURE_LENGTH) {
      fail(`workerSignature должна быть ${SIGNATURE_LENGTH} байта`);
    }
    return {
      qr,
      token,
      serverSignature,
      op,
      workerSignature,
      tokenData: parseTokenOrThrow(token),
      operation: parseOperationOrThrow(op),
    };
  });
  return result.ok ? { ok: true, payload: result.value } : result;
}

/** Parses only the token string (the worker's certificate from GET /api/auth/worker-cert). */
export function parseToken(token: string): { ok: true; token: ServerSignedToken } | { ok: false; error: string } {
  const result = wrap(() => {
    decodePart(token, 'token');
    return parseTokenOrThrow(token);
  });
  return result.ok ? { ok: true, token: result.value } : result;
}
