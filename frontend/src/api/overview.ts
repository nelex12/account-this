// src/api/overview.ts
import { useQuery } from '@tanstack/react-query';
import type { Condition } from '../entities/journalModel';
import { queryKeys } from './queryKeys';

/* ---------------------------------- Types ----------------------------------- */

export type SummaryId = 'registry' | 'broken' | 'requests' | 'issued' | 'accepted' | 'waiting';

export interface OverviewSummary {
  id: SummaryId;
  label: string;
  value: number;
  caption?: string;
}

export interface OverviewHistoryRow {
  id: string;
  time: string;
  toolName: string;
  toolNumber: string;
  action: string;
  employee: string;
  condition: Condition;
}

export interface OverviewData {
  summary: OverviewSummary[];
  history: OverviewHistoryRow[];
}

/* --------------------------------- Mocks ----------------------------------- */

const ok: Condition = { label: 'Исправен', color: 'success' };
const broken: Condition = { label: 'Сломан', color: 'error' };

const mockOverview: OverviewData = {
  summary: [
    { id: 'registry', label: 'Инструментов в реестре', value: 25, caption: '8 на руках' },
    { id: 'broken',   label: 'Неисправны',             value: 7,  caption: '4 повреждены · 3 сломаны' },
    { id: 'requests', label: 'Заявки на доступ',       value: 3,  caption: '3 новые' },
    { id: 'issued',   label: 'Выдано сегодня',         value: 8 },
    { id: 'accepted', label: 'Принято сегодня',        value: 3 },
    { id: 'waiting',  label: 'Ожидают',                value: 8 },
  ],
  history: [
    { id: '1', time: '16:42', toolName: 'Перфоратор Bosch GBH 2-26', toolNumber: '№0142', action: 'Возврат', employee: 'Иванов И. И.',    condition: ok },
    { id: '2', time: '16:10', toolName: 'Шуруповёрт Makita DDF485',  toolNumber: '№0087', action: 'Выдача',  employee: 'Смирнова Е. В.', condition: ok },
    { id: '3', time: '15:35', toolName: 'Болгарка DeWalt DWE4157',   toolNumber: '№0213', action: 'Возврат', employee: 'Кузнецов Д. А.', condition: ok },
    { id: '4', time: '14:58', toolName: 'Дрель Bosch SGB 235',       toolNumber: '№0001', action: 'Возврат', employee: 'Орлов М. К.',    condition: ok },
    { id: '5', time: '14:20', toolName: 'Лазерный уровень GLL 3-80', toolNumber: '№0310', action: 'Выдача',  employee: 'Васильев П. Н.', condition: ok },
    { id: '6', time: '13:47', toolName: 'Рубанок Makita KP0800',     toolNumber: '№0054', action: 'Возврат', employee: 'Новиков С. Р.',  condition: broken },
  ],
};

/* ------------------------------- Raw functions ------------------------------ */

export async function getOverview(): Promise<OverviewData> {
  await new Promise((r) => setTimeout(r, 300));
  return mockOverview;
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: getOverview,
  });
}