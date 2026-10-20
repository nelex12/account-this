// workerQr.ts — what the Issuer's scanner accepts as "a worker's QR".
//
// Cheap shape check of OfflineRentalPayload: AT1.<token>.<serverSig>.<op>.<workerSig>.
// Strict parsing and signature verification come later (see "Формат QR и подписей");
// this only filters out foreign QR codes at scan time.
export function looksLikeWorkerQr(text: string): boolean {
  const parts = text.trim().split('.');
  return parts.length === 5 && parts[0] === 'AT1' && parts.every(Boolean);
}
