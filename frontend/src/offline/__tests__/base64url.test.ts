import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, isBase64Url, utf8DecodeStrict } from '../base64url';

describe('base64url', () => {
  it('encodes without padding and with the URL alphabet', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-');
    expect(base64UrlEncode(new Uint8Array([1]))).toBe('AQ');
    expect(base64UrlEncode(new Uint8Array([]))).toBe('');
  });

  it('round-trips every length', () => {
    for (let n = 1; n < 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
    }
  });

  it.each(['', 'AQ==', 'A+B/', 'AQ.', 'AQ ', 'A', 'AAAAA'])('rejects %j', (bad) => {
    expect(isBase64Url(bad)).toBe(false);
    expect(() => base64UrlDecode(bad)).toThrow();
  });

  it('decodes UTF-8 strictly', () => {
    expect(utf8DecodeStrict(new TextEncoder().encode('Дрель'))).toBe('Дрель');
    expect(() => utf8DecodeStrict(new Uint8Array([0xff, 0xfe]))).toThrow();
  });
});
