// src/entities/profileModel.ts
export interface ProfileData {
  fullName: string;
  /** Normalized phone, e.g. "+79991234567" */
  phone: string;
  /** Display-ready role label, e.g. "Владелец" */
  role: string;
  /**
   * Mock only — real app never has the password on the client.
   * The password is fetched from a `/api/profile` endpoint only when needed,
   * or never (user can only *change* it, not read it).
   */
  password: string;
}