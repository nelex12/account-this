// src/api/users.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserRow, type UserDto, type UserRow } from '../entities/usersModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/* --------------------------------- helpers --------------------------------- */

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
  const detail = await readDetail(response);
  if (response.status === 403 && !detail) {
    throw new ApiError('Нет доступа: действие доступно только владельцу', 403);
  }
  throw new ApiError(detail ?? `${fallback} (${response.status})`, response.status);
}

/* ------------------------------- Raw functions ------------------------------ */

/** GET /api/users — Owner only, users of the caller's company (incl. pending and fired). */
export async function getUsers(): Promise<UserRow[]> {
  const response = await apiFetch('/api/users');
  if (!response.ok) return failFrom(response, 'Не удалось загрузить пользователей');
  return ((await response.json()) as UserDto[]).map(toUserRow);
}

/** POST /api/users/{id}/approve — 200 without body, repeat call is also 200. */
export async function approveUser(id: string): Promise<void> {
  const response = await apiFetch(`/api/users/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
  if (!response.ok) return failFrom(response, 'Не удалось подтвердить пользователя');
}

/**
 * DELETE /api/users/{id} — deactivates (is_active = false) and revokes all sessions.
 * Irreversible: there is no reactivation endpoint. Used for both
 * "reject an application" and "fire". 409 = tried to fire yourself.
 */
export async function deactivateUser(id: string): Promise<void> {
  const response = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return failFrom(response, 'Не удалось деактивировать пользователя');
}

export interface Company {
  id: string;
  name: string;
}

/** GET /api/companies/my — the id the Owner gives to new employees/issuers. */
export async function getMyCompany(): Promise<Company> {
  const response = await apiFetch('/api/companies/my');
  if (!response.ok) return failFrom(response, 'Не удалось загрузить компанию');
  return (await response.json()) as Company;
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: getUsers });
}

export function useMyCompany() {
  return useQuery({
    queryKey: queryKeys.company,
    queryFn: getMyCompany,
    staleTime: Infinity, // company id never changes
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}