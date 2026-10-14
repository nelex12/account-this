// src/entities/authModel.ts

export const ROLES = ['Owner', 'Issuer', 'Worker'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Identity decoded from the access token (JWT claims: sub, role, company_id). */
export interface AuthUser {
  /** `sub` claim: user GUID. */
  id: string;
  /** `company_id` claim: company GUID. */
  companyId: string;
  role: Role;
  /**
   * The backend does not put the name in the token (yet). Optional so pages
   * can keep falling back to the profile endpoint.
   */
  fullName?: string;
}