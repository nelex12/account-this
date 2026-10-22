import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode } from '../base64url';
import { registryWarnings, verifyWorkerQr, type VerifyContext } from '../verifyQr';
import { VECTOR } from './fixtures';
import { SERVER_PUBLIC_KEY, TOOL_ID, forgeQr, withPart } from './helpers';

const OP_TIME = 1790003600;
const ctx = (over: Partial<VerifyContext> = {}): VerifyContext => ({
  serverPublicKey: SERVER_PUBLIC_KEY,
  serverNowSec: OP_TIME,
  isDuplicate: () => false,
  ...over,
});

describe('verifyWorkerQr', () => {
  it('accepts the golden vector', async () => {
    const r = await verifyWorkerQr(VECTOR.qr, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.operation.toolName).toBe('Дрель Bosch');
  });

  it('accepts a QR made by forgeQr with default values', async () => {
    expect((await verifyWorkerQr(await forgeQr(), ctx())).ok).toBe(true);
  });

  it('1. FORMAT: not an AT1 string', async () => {
    const r = await verifyWorkerQr('hello', ctx());
    expect(r).toMatchObject({ ok: false, reason: 'FORMAT' });
  });

  it('2. INVALID_SERVER_SIG: token signed by another key', async () => {
    const otherSeed = base64UrlEncode(new Uint8Array(32).fill(9));
    const r = await verifyWorkerQr(await forgeQr({ serverSeed: otherSeed }), ctx());
    expect(r).toMatchObject({ ok: false, reason: 'INVALID_SERVER_SIG' });
  });

  it('2. INVALID_SERVER_SIG: token edited after signing (worker id swapped)', async () => {
    const other = await forgeQr({ workerId: '00000000-0000-4000-8000-000000000001' });
    // other token + the original server signature
    const forged = withPart(other, 2, VECTOR.serverSignature);
    expect(await verifyWorkerQr(forged, ctx())).toMatchObject({ ok: false, reason: 'INVALID_SERVER_SIG' });
  });

  it('3. INVALID_WORKER_SIG: operation edited after signing (Damaged -> Good)', async () => {
    const edited = await forgeQr({ operation: { toolCondition: 'Damaged' } });
    const forged = withPart(VECTOR.qr, 3, edited.split('.')[3]);
    expect(await verifyWorkerQr(forged, ctx())).toMatchObject({ ok: false, reason: 'INVALID_WORKER_SIG' });
  });

  it('3. INVALID_WORKER_SIG: signed with a key that is not in the certificate', async () => {
    const intruder = base64UrlEncode(new Uint8Array(32).fill(7));
    const a = await forgeQr(); // honest token (worker key = default)
    const b = await forgeQr({ workerSeed: intruder }); // op signed by another key, same token fields except pubkey
    // keep honest token + server signature, take op + signature from the intruder
    const forged = withPart(withPart(a, 3, b.split('.')[3]), 4, b.split('.')[4]);
    expect(await verifyWorkerQr(forged, ctx())).toMatchObject({ ok: false, reason: 'INVALID_WORKER_SIG' });
  });

  it('3. INVALID_WORKER_SIG: signature of another operation', async () => {
    const other = await forgeQr({ operation: { timestamp: OP_TIME + 1 } });
    expect(await verifyWorkerQr(withPart(VECTOR.qr, 4, other.split('.')[4]), ctx())).toMatchObject({
      ok: false,
      reason: 'INVALID_WORKER_SIG',
    });
  });

  it('4. EXPIRED_TOKEN: operation after expiresAt / before issuedAt', async () => {
    const late = await forgeQr({ operation: { timestamp: 1790043201 } });
    expect(await verifyWorkerQr(late, ctx({ serverNowSec: 1790043201 }))).toMatchObject({ reason: 'EXPIRED_TOKEN' });
    const early = await forgeQr({ operation: { timestamp: 1789999999 } });
    expect(await verifyWorkerQr(early, ctx({ serverNowSec: 1789999999 }))).toMatchObject({ reason: 'EXPIRED_TOKEN' });
  });

  it('4. the interval is inclusive: issuedAt and expiresAt themselves are fine', async () => {
    for (const t of [1790000000, 1790043200]) {
      const qr = await forgeQr({ operation: { timestamp: t } });
      expect((await verifyWorkerQr(qr, ctx({ serverNowSec: t }))).ok).toBe(true);
    }
  });

  it('5. TIME_DRIFT: more than 60 s from server time, either direction; exactly 60 is fine', async () => {
    expect((await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: OP_TIME + 60 }))).ok).toBe(true);
    expect((await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: OP_TIME - 60 }))).ok).toBe(true);
    expect(await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: OP_TIME + 61 }))).toMatchObject({ reason: 'TIME_DRIFT' });
    expect(await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: OP_TIME - 61 }))).toMatchObject({ reason: 'TIME_DRIFT' });
  });

  it('6. DUPLICATE: the journal already has this workerSignature', async () => {
    const seen: string[] = [];
    const r = await verifyWorkerQr(
      VECTOR.qr,
      ctx({ isDuplicate: async (sig) => (seen.push(sig), true) }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'DUPLICATE' });
    expect(seen).toEqual([VECTOR.workerSignature]);
  });

  it('checks in the documented order: signature errors win over expiry, expiry over drift, drift over duplicate', async () => {
    const expiredAndDrifting = await forgeQr({ operation: { timestamp: 1790043201 } });
    expect(await verifyWorkerQr(expiredAndDrifting, ctx({ serverNowSec: OP_TIME, isDuplicate: () => true }))).toMatchObject({
      reason: 'EXPIRED_TOKEN',
    });
    expect(await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: OP_TIME + 500, isDuplicate: () => true }))).toMatchObject({
      reason: 'TIME_DRIFT',
    });
    const badServer = await verifyWorkerQr(VECTOR.qr, ctx({ serverPublicKey: base64UrlDecode(VECTOR.workerPublicKey), serverNowSec: 0 }));
    expect(badServer).toMatchObject({ reason: 'INVALID_SERVER_SIG' });
  });

  it('does not ask the journal when an earlier check already failed', async () => {
    let asked = false;
    await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: 0, isDuplicate: () => ((asked = true), false) }));
    expect(asked).toBe(false);
  });

  it('a rejection carries a message for the screen and the parsed payload', async () => {
    const r = await verifyWorkerQr(VECTOR.qr, ctx({ serverNowSec: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/Время/);
      expect(r.payload?.operation.toolId).toBe(TOOL_ID);
    }
  });
});

describe('registryWarnings', () => {
  it('unknown tool', () => {
    expect(registryWarnings({ toolCondition: 'Good' }, undefined)).toEqual([{ kind: 'UNKNOWN_TOOL' }]);
  });
  it('condition mismatch is a warning, not a failure', () => {
    expect(registryWarnings({ toolCondition: 'Broken' }, { condition: 'Good' })).toEqual([
      { kind: 'CONDITION_MISMATCH', registered: 'Good', claimed: 'Broken' },
    ]);
  });
  it('no warnings when everything matches', () => {
    expect(registryWarnings({ toolCondition: 'Good' }, { condition: 'Good' })).toEqual([]);
  });
});
