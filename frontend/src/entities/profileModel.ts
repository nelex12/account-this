// src/entities/profileModel.ts
import type { Role } from './authModel';

/**
 * Data for the profile page, assembled from what the API can give per role
 * (see api/profile.ts). Optional fields are `undefined` when the backend
 * has no way to provide them for this role yet.
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