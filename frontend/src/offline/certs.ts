// certs.ts — the Worker's certificate + signing key on the device (store `certs`, one per user).
// The key is a non-extractable CryptoKey where WebCrypto supports Ed25519, so the seed
// cannot be read back out of the browser, only used to sign.
import { getDb } from './db';
import { isCertificateValidAt, type StoredCertificate } from './workerSigner';

export async function saveCertificate(cert: StoredCertificate): Promise<void> {
  await (await getDb()).put('certs', cert);
}

export async function getCertificate(userId: string): Promise<StoredCertificate | undefined> {
  return (await getDb()).get('certs', userId);
}

/** The saved certificate if it is valid at this server time, else undefined (-> fetch a new one online). */
export async function getValidCertificate(
  userId: string,
  serverNowSec: number,
): Promise<StoredCertificate | undefined> {
  const cert = await getCertificate(userId);
  return cert && isCertificateValidAt(cert, serverNowSec) ? cert : undefined;
}

/** On logout: the signing key must not outlive the session. */
export async function deleteCertificate(userId: string): Promise<void> {
  await (await getDb()).delete('certs', userId);
}
