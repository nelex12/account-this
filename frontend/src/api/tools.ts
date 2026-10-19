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
 * Wired to the backend: GET /api/tools, GET /api/tools/{id}, POST /api/tools,
 * PATCH /api/tools/{id}. DELETE (write off) is NOT wired yet: it throws until
 * the backend side is confirmed ready for the UI.
 */

/* --------------------------------- helpers --------------------------------- */

interface ProblemBody {
  detail?: unknown;
  errors?: Record<string, string[]>;
}

/** Parsed ProblemDetails / ValidationProblemDetails, or null if there is no JSON body. */
async function readProblem(response: Response): Promise<ProblemBody | null> {
  try {
    return (await response.json()) as ProblemBody;
  } catch {
    return null; // 401/403 from the JWT layer come without a body
  }
}

/**
 * Throws ApiError for a non-2xx response:
 *  - 403 -> role has no access;
 *  - 400 -> ValidationProblemDetails: messages per field go to ApiError.fieldErrors
 *    (keys are JSON field names, e.g. `name`, `condition`, `id`);
 *  - 415 -> body was not sent as application/json;
 *  - others -> ProblemDetails.detail (Russian, meant for the user) if present.
 */
async function failFrom(response: Response, fallback: string): Promise<never> {
  if (response.status === 403) {
    throw new ApiError('Нет доступа к инструментам для вашей роли', 403);
  }

  const body = await readProblem(response);

  if (response.status === 400 && body?.errors) {
    const first = Object.values(body.errors).flat()[0];
    throw new ApiError(first ?? 'Некорректные данные', 400, body.errors);
  }

  if (response.status === 415) {
    throw new ApiError('Сервер не принял формат запроса (ожидается JSON)', 415);
  }

  const detail = typeof body?.detail === 'string' ? body.detail : undefined;
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

/**
 * POST /api/tools — Issuer, Owner. 201 + the created Tool (id assigned by the DB).
 * 400 = ValidationProblemDetails: messages per field are in ApiError.fieldErrors
 * (key `name`). The tool is always created Good / no comment / no holder.
 */
export async function createTool(payload: CreateToolRequest): Promise<Tool> {
  const response = await apiFetch('/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return failFrom(response, 'Не удалось добавить инструмент');
  return (await response.json()) as Tool;
}

/**
 * PATCH /api/tools/{id} — Issuer, Owner. 200 without body.
 * A field that is absent (or null) is unchanged; `comment: ""` clears the comment.
 * Allowed for written-off tools too. 404 = no such tool in the caller's company.
 */
export async function updateToolCondition(
  id: string,
  payload: UpdateToolConditionRequest,
): Promise<void> {
  const response = await apiFetch(`/api/tools/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return failFrom(response, 'Не удалось обновить инструмент');
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
    // ['tools'] is a prefix of ['tools', id], so the list and the opened tool both refetch
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