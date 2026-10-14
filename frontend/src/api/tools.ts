// src/api/tools.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateToolRequest,
  Tool,
  UpdateToolConditionRequest,
} from '../entities/toolsModel';
import { ApiError } from './auth';
import { queryKeys } from './queryKeys';

/*
 * Mocks live here (like journal.ts / overview.ts) so the pages never touch
 * `mock/*` directly. When the backend is wired, replace each function body
 * with an apiFetch call (see the comment above getTools) — the shapes already
 * match api.yaml, so no caller has to change.
 */

/* --------------------------------- Mocks ----------------------------------- */

const mockTools: Tool[] = [
  {
    id: '17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35',
    name: 'Дрель Bosch SGB 235',
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  },
  {
    id: '2a6f9d34-81c5-4b07-a3e2-6d5c7f1e9b08',
    name: 'Перфоратор Bosch GBH 2-26',
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  },
  {
    id: '5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21',
    name: 'Шуруповёрт Makita DDF485',
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: '8e0c3a6f-4b21-4a63-9d17-5b1d0c8a2f4e',
    holderName: 'Смирнова Е. В.',
    heldSince: 1790003600,
  },
  {
    id: '3d2f5b81-0c4a-4e17-9b21-7f6e8d1c3a50',
    name: 'Болгарка DeWalt DWE4157',
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  },
  {
    id: '9c1e6d42-7a83-4f10-8e5b-2d4c6f0a1b73',
    name: 'Лазерный уровень GLL 3-80',
    condition: 'Damaged',
    comment: 'Трещина на корпусе',
    isActive: true,
    holderId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    holderName: 'Васильев П. Н.',
    heldSince: 1790001200,
  },
  {
    id: '4e7a1b29-6c35-4d80-9f12-3b8e5a0c7d64',
    name: 'Рубанок Makita KP0800',
    condition: 'Broken',
    comment: 'Не включается',
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  },
  {
    id: '6b8c0d13-2e49-4a57-9d80-1f3c5e7a9b24',
    name: 'Набор свёрл Bosch, 19 шт.',
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: '8e0c3a6f-4b21-4a63-9d17-5b1d0c8a2f4e',
    holderName: 'Смирнова Е. В.',
    heldSince: 1789999800,
  },
  {
    id: '0f3a7c51-8d24-4e69-9b12-5a6c8e0d2f47',
    name: 'Лобзик Bosch PST 700',
    condition: 'Damaged',
    comment: 'Погнут корпус',
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  },
];

/* ------------------------------- Raw functions ------------------------------ */

/**
 * GET /api/tools — Issuer, Owner.
 * Real implementation:
 *   const res = await apiFetch('/api/tools');
 *   if (!res.ok) return failFrom(res, 'Не удалось загрузить инструменты');
 *   return res.json() as Promise<Tool[]>;
 */
export async function getTools(): Promise<Tool[]> {
  await new Promise((r) => setTimeout(r, 300));
  return mockTools;
}

/** GET /api/tools/{id} — Issuer, Owner. Includes written-off tools. */
export async function getTool(id: string): Promise<Tool> {
  await new Promise((r) => setTimeout(r, 200));
  const tool = mockTools.find((t) => t.id === id);
  if (!tool) throw new ApiError('Инструмент не найден', 404);
  return tool;
}

/** POST /api/tools — Issuer, Owner. Returns the tool with its new id. */
export async function createTool(payload: CreateToolRequest): Promise<Tool> {
  await new Promise((r) => setTimeout(r, 200));
  const tool: Tool = {
    id: crypto.randomUUID(),
    name: payload.name,
    condition: 'Good',
    comment: null,
    isActive: true,
    holderId: null,
    holderName: null,
    heldSince: null,
  };
  mockTools.push(tool);
  return tool;
}

/** PATCH /api/tools/{id} — Issuer, Owner. Absent/null field = unchanged. */
export async function updateToolCondition(
  id: string,
  payload: UpdateToolConditionRequest,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  const tool = mockTools.find((t) => t.id === id);
  if (!tool) throw new ApiError('Инструмент не найден', 404);
  if (payload.condition !== undefined && payload.condition !== null) {
    tool.condition = payload.condition;
  }
  if (payload.comment !== undefined) {
    tool.comment = payload.comment;
  }
}

/** DELETE /api/tools/{id} — Owner. Sets isActive = false; repeat calls are 200. */
export async function deleteTool(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  const tool = mockTools.find((t) => t.id === id);
  if (!tool) throw new ApiError('Инструмент не найден', 404);
  tool.isActive = false;
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