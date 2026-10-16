// src/api/tools.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateToolRequest,
  Tool,
  UpdateToolConditionRequest,
} from '../entities/toolsModel';
import { ApiError } from './auth';
import { apiFetch } from './http';
import { queryKeys } from './queryKeys';

/*
 * Reading (GET /api/tools, GET /api/tools/{id}) goes to the backend.
 * Writing (create / update condition / write off) is NOT wired yet: those
 * functions throw until the backend side is confirmed ready for the UI.
 */

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
  if (response.status === 403) {
    throw new ApiError('Нет доступа к инструментам для вашей роли', 403);
  }
  const detail = await readDetail(response);
  throw new ApiError(detail ?? `${fallback} (${response.status})`, response.status);
}

function notWired(what: string): never {
  throw new ApiError(`${what}: пока не подключено к серверу`, 501);
}

/* ------------------------------- Raw functions ------------------------------ */

/** GET /api/tools — Issuer, Owner. Active (not written-off) tools of the caller's company. */
export async function getTools(): Promise<Tool[]> {
  const response = await apiFetch('/api/tools');
  if (!response.ok) return failFrom(response, 'Не удалось загрузить инструменты');
  return (await response.json()) as Tool[];
}

/** GET /api/tools/{id} — Issuer, Owner. Includes written-off tools; 404 for other companies. */
export async function getTool(id: string): Promise<Tool> {
  const response = await apiFetch(`/api/tools/${encodeURIComponent(id)}`);
  if (!response.ok) return failFrom(response, 'Не удалось загрузить инструмент');
  return (await response.json()) as Tool;
}

/** POST /api/tools — not wired yet. */
export async function createTool(_payload: CreateToolRequest): Promise<Tool> {
  return notWired('Добавление инструмента');
}

/** PATCH /api/tools/{id} — not wired yet. */
export async function updateToolCondition(
  _id: string,
  _payload: UpdateToolConditionRequest,
): Promise<void> {
  return notWired('Изменение состояния инструмента');
}

/** DELETE /api/tools/{id} — not wired yet. */
export async function deleteTool(_id: string): Promise<void> {
  return notWired('Списание инструмента');
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useTools() {
  return useQuery({
    queryKey: queryKeys.tools,
    queryFn: getTools,
  });
}

export function useTool(id: string) {
  return useQuery({
    queryKey: [...queryKeys.tools, id],
    queryFn: () => getTool(id),
    enabled: Boolean(id),
  });
}

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tools }),
  });
}

export function useUpdateToolCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateToolConditionRequest;
    }) => updateToolCondition(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tools }),
  });
}

export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tools }),
  });
}