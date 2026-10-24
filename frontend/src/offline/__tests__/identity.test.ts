import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '../db';
import {
  clearIdentity,
  clearPendingLogout,
  hasPendingLogout,
  loadIdentity,
  markPendingLogout,
  saveIdentity,
} from '../identity';
import { setMeta } from '../meta';
import { withLock } from '../lock';

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
});

describe('identity', () => {
  it('Worker and Issuer are remembered; nothing secret is kept', async () => {
    await saveIdentity({ id: 'u1', role: 'Issuer', companyId: 'c1', fullName: 'Петров Пётр' });
    expect(await loadIdentity()).toEqual({ id: 'u1', role: 'Issuer', companyId: 'c1', fullName: 'Петров Пётр' });
    const stored = JSON.stringify(await (await import('../meta')).getMeta('identity'));
    expect(stored).not.toMatch(/token|password|secret/i);
  });

  it('keeps the known name when the token has none (same user only)', async () => {
    await saveIdentity({ id: 'u1', role: 'Worker', companyId: 'c1', fullName: 'Иван' });
    await saveIdentity({ id: 'u1', role: 'Worker', companyId: 'c1' });
    expect((await loadIdentity())?.fullName).toBe('Иван');
    await saveIdentity({ id: 'u2', role: 'Worker', companyId: 'c1' });
    expect((await loadIdentity())?.fullName).toBeUndefined();
  });

  it('an Owner is not remembered, and replaces a remembered worker', async () => {
    await saveIdentity({ id: 'u1', role: 'Worker', companyId: 'c1' });
    await saveIdentity({ id: 'o1', role: 'Owner', companyId: 'c1' });
    expect(await loadIdentity()).toBeNull();
  });

  it('a stored Owner or garbage role is ignored', async () => {
    await setMeta('identity', { userId: 'o1', role: 'Owner', fullName: '', savedAt: 1 });
    expect(await loadIdentity()).toBeNull();
    await setMeta('identity', { userId: 'x', role: 'Hacker' as 'Owner', fullName: '', savedAt: 1 });
    expect(await loadIdentity()).toBeNull();
  });

  it('clearIdentity forgets it', async () => {
    await saveIdentity({ id: 'u1', role: 'Worker', companyId: 'c1' });
    await clearIdentity();
    expect(await loadIdentity()).toBeNull();
  });

  it('pending logout flag', async () => {
    expect(await hasPendingLogout()).toBe(false);
    await markPendingLogout();
    expect(await hasPendingLogout()).toBe(true);
    await clearPendingLogout();
    expect(await hasPendingLogout()).toBe(false);
  });
});

describe('withLock (fallback chain)', () => {
  it('runs tasks of one name one after another, even if an earlier one fails', async () => {
    const order: string[] = [];
    const task = (name: string, ms: number, fail = false) => () =>
      new Promise<string>((resolve, reject) => {
        order.push(`start ${name}`);
        setTimeout(() => {
          order.push(`end ${name}`);
          if (fail) reject(new Error(name));
          else resolve(name);
        }, ms);
      });
    const a = withLock('t', task('a', 20, true));
    const b = withLock('t', task('b', 1));
    await expect(a).rejects.toThrow('a');
    expect(await b).toBe('b');
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
