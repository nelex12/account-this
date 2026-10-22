// Tests run in plain Node (WebCrypto Ed25519 is built in) with fake-indexeddb for storage.
// A separate file keeps the PWA plugin out of the test run.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
