import { describe, expect, it } from 'vitest';
import { computeOffset, serverNowSec } from '../serverTime';

describe('server time', () => {
  it('a phone that is 5 minutes slow still gets the right server time', () => {
    const localNow = 1_790_000_000_000;
    const offset = computeOffset(1_790_000_300, localNow); // server is 300 s ahead
    expect(offset.offsetMs).toBe(300_000);
    // two hours later, offline
    expect(serverNowSec(offset, localNow + 2 * 3600_000)).toBe(1_790_000_300 + 7200);
  });

  it('a fast clock gives a negative offset', () => {
    const offset = computeOffset(1_000, 1_000_000 + 90_000);
    expect(serverNowSec(offset, 1_000_000 + 90_000)).toBe(1_000);
  });

  it('without an offset it falls back to the local clock', () => {
    expect(serverNowSec(null, 1_790_000_123_900)).toBe(1_790_000_123);
  });
});
