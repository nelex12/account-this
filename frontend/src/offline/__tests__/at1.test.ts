import { describe, expect, it } from 'vitest';
import { base64UrlEncode, base64UrlEncodeText } from '../base64url';
import { encodeOperation, parseAt1, parseToken } from '../at1';
import { VECTOR } from './fixtures';
import { TOOL_ID, WORKER_ID, withPart } from './helpers';

const SIG = base64UrlEncode(new Uint8Array(64));
const PUB = base64UrlEncode(new Uint8Array(32));

const tokenJson = (patch: string | null = null) =>
  patch ??
  `{"workerId":"${WORKER_ID}","fio":"Иванов Иван","issuedAt":1790000000,"expiresAt":1790043200,"workerPublicKey":"${PUB}"}`;
const opJson = (patch: string | null = null) =>
  patch ??
  `{"action":"TAKE","toolCondition":"Damaged","toolId":"${TOOL_ID}","toolName":"Дрель","timestamp":1790003600}`;

/** A structurally valid QR (signatures are not checked by the parser) with replaceable parts. */
const qr = (o: { token?: string; sig1?: string; op?: string; sig2?: string } = {}) =>
  `AT1.${o.token ?? base64UrlEncodeText(tokenJson())}.${o.sig1 ?? SIG}.${o.op ?? base64UrlEncodeText(opJson())}.${o.sig2 ?? SIG}`;

const okPayload = (s: string) => {
  const r = parseAt1(s);
  if (!r.ok) throw new Error(r.error);
  return r.payload;
};

describe('parseAt1: valid strings', () => {
  it('parses the golden vector and keeps the raw parts', () => {
    const p = okPayload(VECTOR.qr);
    expect(p.qr).toBe(VECTOR.qr);
    expect(p.token).toBe(VECTOR.token);
    expect(p.serverSignature).toBe(VECTOR.serverSignature);
    expect(p.op).toBe(VECTOR.op);
    expect(p.workerSignature).toBe(VECTOR.workerSignature);
    expect(p.tokenData).toEqual({
      workerId: WORKER_ID,
      fio: 'Иванов Иван Иванович',
      issuedAt: 1790000000,
      expiresAt: 1790043200,
      workerPublicKey: VECTOR.workerPublicKey,
    });
    expect(p.operation).toEqual({
      action: 'TAKE',
      toolCondition: 'Good',
      toolId: TOOL_ID,
      toolName: 'Дрель Bosch',
      timestamp: 1790003600,
    });
  });

  it('ignores field order, whitespace and extra fields', () => {
    const op = ` { "extra": [1, {"a": 2}], "timestamp": 1790003600, "toolName": "Дрель", "toolId": "${TOOL_ID}", "toolCondition": "Good", "action": "GIVE" } `;
    expect(okPayload(qr({ op: base64UrlEncodeText(op) })).operation.action).toBe('GIVE');
  });

  it('accepts a duplicated key inside an extra nested object (the server does too)', () => {
    const op = `{"x":{"a":1,"a":2},"action":"TAKE","toolCondition":"Good","toolId":"${TOOL_ID}","toolName":"T","timestamp":1790003600}`;
    expect(parseAt1(qr({ op: base64UrlEncodeText(op) })).ok).toBe(true);
  });

  it('round-trips encodeOperation', () => {
    const operation = { action: 'GIVE', toolCondition: 'Broken', toolId: TOOL_ID, toolName: 'Ключ "17" <&>', timestamp: 5 } as const;
    expect(okPayload(qr({ op: encodeOperation(operation) })).operation).toEqual(operation);
  });
});

describe('parseAt1: rejected strings', () => {
  const T = (json: string) => qr({ token: base64UrlEncodeText(json) });
  const O = (json: string) => qr({ op: base64UrlEncodeText(json) });
  const goodTok = tokenJson();
  const goodOp = opJson();

  const cases: [string, string][] = [
    ['empty string', ''],
    ['only version', 'AT1'],
    ['4 parts', `AT1.${base64UrlEncodeText(goodTok)}.${SIG}.${base64UrlEncodeText(goodOp)}`],
    ['6 parts', qr() + '.extra'],
    ['wrong version', qr().replace('AT1', 'AT2')],
    ['lower-case version', qr().replace('AT1', 'at1')],
    ['padding "=" in a part', withPart(qr(), 1, base64UrlEncodeText(goodTok) + '=')],
    ['"+" and "/" in a signature', withPart(qr(), 4, SIG.slice(0, -2) + '+/')],
    ['empty part', withPart(qr(), 1, '')],
    ['length n % 4 == 1', withPart(qr(), 4, SIG + 'AAA')],
    ['signature too short (63 bytes)', qr({ sig1: base64UrlEncode(new Uint8Array(63)) })],
    ['signature too long (65 bytes)', qr({ sig2: base64UrlEncode(new Uint8Array(65)) })],
    ['workerPublicKey 31 bytes', T(goodTok.replace(PUB, base64UrlEncode(new Uint8Array(31))))],
    ['workerPublicKey not base64url', T(goodTok.replace(PUB, 'not valid!'))],
    ['token is not JSON', T('not json')],
    ['token is an array', T('[]')],
    ['token is null', T('null')],
    ['token is a string', T('"text"')],
    ['op is not JSON', O('{')],
    ['op is an array', O('[1]')],
    ['token: no workerId', T(goodTok.replace(/"workerId":"[^"]+",/, ''))],
    ['token: no fio', T(goodTok.replace('"fio":"Иванов Иван",', ''))],
    ['token: fio is null', T(goodTok.replace('"Иванов Иван"', 'null'))],
    ['token: fio is a number', T(goodTok.replace('"Иванов Иван"', '5'))],
    ['token: duplicated field', T(goodTok.replace('{', '{"fio":"Другой",'))],
    ['op: duplicated field', O(goodOp.replace('{', '{"action":"GIVE",'))],
    ['op: no timestamp', O(goodOp.replace(',"timestamp":1790003600', ''))],
    ['issuedAt as a string', T(goodTok.replace('1790000000', '"1790000000"'))],
    ['timestamp as a string', O(goodOp.replace('1790003600', '"1790003600"'))],
    ['timestamp with fraction', O(goodOp.replace('1790003600', '1790003600.5'))],
    ['timestamp 1.0', O(goodOp.replace('1790003600', '1790003600.0'))],
    ['timestamp as exponent', O(goodOp.replace('1790003600', '1.7900036e9'))],
    ['timestamp true', O(goodOp.replace('1790003600', 'true'))],
    ['timestamp beyond 2^53', O(goodOp.replace('1790003600', '99999999999999999999'))],
    ['workerId upper case', T(goodTok.replace(WORKER_ID, WORKER_ID.toUpperCase()))],
    ['workerId without dashes', T(goodTok.replace(WORKER_ID, WORKER_ID.replaceAll('-', '')))],
    ['workerId with braces', T(goodTok.replace(WORKER_ID, `{${WORKER_ID}}`))],
    ['toolId not a UUID', O(goodOp.replace(TOOL_ID, 'tool-1'))],
    ['action in lower case', O(goodOp.replace('"TAKE"', '"take"'))],
    ['action as a number', O(goodOp.replace('"TAKE"', '0'))],
    ['unknown action', O(goodOp.replace('"TAKE"', '"STEAL"'))],
    ['toolCondition lower case', O(goodOp.replace('Damaged', 'damaged'))],
    ['toolCondition as a number', O(goodOp.replace('"Damaged"', '1'))],
  ];

  it.each(cases)('%s', (_name, input) => {
    const r = parseAt1(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Строка не соответствует формату AT1: /);
  });

  it('rejects invalid UTF-8 inside token', () => {
    const bad = base64UrlEncode(new Uint8Array([0x7b, 0xff, 0x7d])); // {\xff}
    expect(parseAt1(qr({ token: bad })).ok).toBe(false);
  });

  it('a key written with an escape still counts as the same key', () => {
    // "action" == "action": a second spelling of the same field is a duplicate
    expect(parseAt1(O(goodOp.replace('{', '{"\\u0061ction":"GIVE",'))).ok).toBe(false);
  });
});

describe('parseToken', () => {
  it('parses the golden token', () => {
    const r = parseToken(VECTOR.token);
    expect(r.ok && r.token.workerId).toBe(WORKER_ID);
  });
  it('rejects garbage', () => {
    expect(parseToken('###').ok).toBe(false);
    expect(parseToken(base64UrlEncodeText('{}')).ok).toBe(false);
  });
});
