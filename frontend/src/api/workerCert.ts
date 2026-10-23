// src/api/workerCert.ts — GET /api/auth/worker-cert (Worker only).
//
// The server generates a temporary Ed25519 key pair, signs a token for it (valid 12 hours) and
// returns { token, serverSignature, temporaryPrivateKey, serverTime }. The private key is not
// stored by the server: it exists only in this response. See src/offline/certificateService.ts.
import { CertificateFetchError } from '../offline/certificateService';
import type { WorkerCertificateResponse } from '../offline/workerSigner';
import { apiFetch } from './http';

export async function fetchWorkerCertificate(): Promise<WorkerCertificateResponse> {
  let response: Response;
  try {
    response = await apiFetch('/api/auth/worker-cert');
  } catch {
    throw new CertificateFetchError('network', 'Нет соединения с сервером');
  }

  if (response.ok) return (await response.json()) as WorkerCertificateResponse;

  if (response.status === 403) {
    // Role is not Worker: no body. Not approved / dismissed: ProblemDetails with `detail`.
    let detail: string | undefined;
    try {
      detail = ((await response.json()) as { detail?: string }).detail;
    } catch {
      /* no body */
    }
    throw new CertificateFetchError('forbidden', detail ?? 'Доступ закрыт');
  }
  // 5xx while the device is "online" but the server is down is as good as offline for the user
  throw new CertificateFetchError('server', `Не удалось получить сертификат (${response.status})`);
}
