// src/entities/notificationsModel.ts
/** Mirrors api.yaml Notification / NotificationType. */

export type NotificationType =
  | 'EmployeeAwaitingApproval'
  | 'SessionReuseDetected'
  | 'SuspiciousSync';

/** api.yaml Notification — item of GET /api/notifications (Owner only). */
export interface Notification {
  id: number;
  type: NotificationType;
  /** Unix seconds of the event that created the notification. */
  occurredAt: number;
  /** Who the notification is about (see NotificationType). */
  userId: string;
  /** FIO of that user; null = no longer in the company. */
  userName: string | null;
  /** SuspiciousSync only: ValidationFlag (except VALID) -> number of new records. */
  flags: Record<string, number> | null;
  isRead: boolean;
}

/** Short title per notification type, for lists. */
export const notificationTitles: Record<NotificationType, string> = {
  EmployeeAwaitingApproval: 'Ожидает подтверждения',
  SessionReuseDetected: 'Возможна кража сессии',
  SuspiciousSync: 'Подозрительная синхронизация',
};

/** "Иванов Иван" or a fallback when the user is gone from the company. */
export function getNotificationSubject(notification: Notification): string {
  return notification.userName ?? 'Пользователь удалён';
}

/** Total number of suspicious records in a SuspiciousSync notification. */
export function countFlaggedRecords(notification: Notification): number {
  return Object.values(notification.flags ?? {}).reduce((sum, n) => sum + n, 0);
}