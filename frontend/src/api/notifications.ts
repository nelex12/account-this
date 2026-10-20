// src/api/notifications.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '../entities/notificationsModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/*
 * GET /api/notifications — Owner only. At most 100 latest notifications of the
 * caller's company, newest first; read ones are included (isRead: true).
 * Notifications are created asynchronously by the Worker process, so they show
 * up a moment after the action that caused them: the list is refetched
 * periodically and when the screen is opened.
 *
 * POST /api/notifications/{id}/read — Owner only. 200 without body, repeat call
 * is also 200; a notification of another company is 404.
 */

/** How often the list is refetched while the page is open. */
const REFETCH_INTERVAL_MS = 30_000;

/** ProblemDetails.detail (Russian, meant for the user) if the body has one. */
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === 'string' ? body.detail : undefined;
  } catch {
    return undefined; // 401/403 from the JWT layer come without a body
  }
}

async function failFrom(response: Response, fallback: string): Promise<never> {
  if (response.status === 403) {
    throw new ApiError('Уведомления доступны только владельцу', 403);
  }
  const detail = await readDetail(response);
  throw new ApiError(detail ?? `${fallback} (${response.status})`, response.status);
}

/** GET /api/notifications — Owner. */
export async function getNotifications(): Promise<Notification[]> {
  const response = await apiFetch('/api/notifications');
  if (!response.ok) return failFrom(response, 'Не удалось загрузить уведомления');
  return (await response.json()) as Notification[];
}

/** POST /api/notifications/{id}/read — Owner. `id` is the numeric Notification.id. */
export async function markNotificationRead(id: number): Promise<void> {
  const response = await apiFetch(`/api/notifications/${encodeURIComponent(String(id))}/read`, {
    method: 'POST',
  });
  if (!response.ok) return failFrom(response, 'Не удалось отметить уведомление прочитанным');
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: getNotifications,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    // onSettled, not onSuccess: after a 404 (notification is gone) the list must refetch too
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}