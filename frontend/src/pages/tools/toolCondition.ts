import type { StatusBadgeColor } from '../../shared/ui/StatusBadge';
import type { ToolCondition } from '../../entities/toolsModel';

/** Label + badge color for each tool condition. Shared by the table and the mobile card. */
export const conditionBadge: Record<ToolCondition, { label: string; color: StatusBadgeColor }> = {
  ok: { label: 'Исправен', color: 'success' },
  broken: { label: 'Сломан', color: 'error' },
  inspection: { label: 'На проверке', color: 'warning' },
  damaged: { label: 'Поврежден', color: 'error' },
};