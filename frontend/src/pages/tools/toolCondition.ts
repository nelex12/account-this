// src/pages/tools/toolCondition.ts
import type { StatusBadgeColor } from '../../shared/ui/StatusBadge';
import type { ToolCondition } from '../../entities/toolsModel';

/** Label + badge color for each tool condition. Keys match api.yaml ToolCondition. */
export const conditionBadge: Record<
  ToolCondition,
  { label: string; color: StatusBadgeColor }
> = {
  Good: { label: 'Исправен', color: 'success' },
  Damaged: { label: 'Повреждён', color: 'warning' },
  Broken: { label: 'Сломан', color: 'error' },
};