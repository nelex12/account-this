# src/offline — protocol, crypto and storage for offline work

No React here: plain TypeScript, tested in Node (`npm test`).

| File | What it does |
|---|---|
| `base64url.ts` | base64url without padding (strict, same rules as the backend) |
| `at1.ts` | AT1 QR format: strict parser (identical to backend `QrPayloadParser`), signed-string builders |
| `ed25519.ts` | sign / verify. WebCrypto first (non-extractable keys), `@noble/curves` as lazy fallback |
| `serverTime.ts` | "server time" = local time + offset measured online |
| `workerSigner.ts` | Worker: server certificate -> stored certificate -> signed operation QR |
| `verifyQr.ts` | Issuer: the 6 offline checks in order + registry warnings |
| `db.ts` | IndexedDB schema (`idb`): meta, certs, tools, journal, operations |
| `meta.ts` `certs.ts` `registry.ts` `journal.ts` `operations.ts` | one store each |

Rules worth remembering
- Signatures are checked over the **strings as received**; JSON is never re-serialized.
- A QR that `parseAt1` rejects is also rejected by `POST /api/sync` with 400: the Issuer must never store it.
- The journal is append-only; only `status` (pending → sent / quarantined) changes. Queries are always per user.
- `confirmOperation` writes journal + registry in one transaction; the unique index `[userId, workerSignature]` is the final duplicate guard.
- Test vectors (`__tests__/fixtures.ts`) come from `scripts/gen-test-vectors.py` (Python `cryptography`), not from the app.
