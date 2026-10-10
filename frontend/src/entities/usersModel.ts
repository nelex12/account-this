
export type UserRole = 'сотрудник' | 'заведующий' | 'владелец';
export type UserStatus = 'ожидает' | 'одобрена' | 'отклонена';

export type RoleFilter = 'all' | UserRole;

export interface UserRow {
  id: string;
  applicant: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  /** Date the application was submitted */
  requestedAt: string;
}