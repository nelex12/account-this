// src/entities/usersModel.ts
import type { Role } from './authModel';

/** Same values as the JWT `role` claim and api.yaml UserRole. */
export type UserRole = Role;

/** Derived from isApproved / isActive, see getUserStatus. */
export type UserStatus = 'pending' | 'active' | 'fired';

export type RoleFilter = 'all' | UserRole;

/** api.yaml UserResponse: item of GET /api/users. */
export interface UserDto {
  id: string;
  fullName: string;
  /** Normalized by the server: +7XXXXXXXXXX */
  phone: string;
  role: UserRole;
  /** false = waiting for the Owner's approval */
  isApproved: boolean;
  /** false = fired (record is never deleted) */
  isActive: boolean;
}

export interface UserRow extends UserDto {
  status: UserStatus;
}

/** Fired wins over everything: a rejected application is also a deactivated user. */
export function getUserStatus(user: Pick<UserDto, 'isApproved' | 'isActive'>): UserStatus {
  if (!user.isActive) return 'fired';
  if (!user.isApproved) return 'pending';
  return 'active';
}

export function toUserRow(dto: UserDto): UserRow {
  return { ...dto, status: getUserStatus(dto) };
}

/** +79991234567 -> +7 999 123-45-67 (display only; never send it back). */
export function formatPhone(phone: string): string {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : phone;
}