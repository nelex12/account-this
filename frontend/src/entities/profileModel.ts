// src/entities/profileModel.ts
import type { Role } from './authModel';

/**
 * Data for the profile page: GET /api/users/me + GET /api/companies/my
 * (see api/profile.ts). Optional fields are `undefined` if a request failed.
 */
export interface ProfileData {
  /** `sub` claim of the access token */
  id: string;
  role: Role;
  fullName?: string;
  /** Normalized phone, e.g. "+79991234567" */
  phone?: string;
  companyName?: string;
}