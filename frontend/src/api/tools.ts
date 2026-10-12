// src/api/tools.ts
import { useQuery } from '@tanstack/react-query';
import type { Tool, ToolRow, ToolCondition } from '../entities/toolsModel';
import { queryKeys } from './queryKeys';

const mockTools: ToolRow[] = [
  { id: '1', name: 'Дрель Bosch SGB 235', number: '№0001', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж A1', updated: '02.10.2026', issued: false },
  { id: '2', name: 'Перфоратор Bosch GBH 2-26', number: '№0142', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж A2', updated: '02.10.2026', issued: false },
  { id: '3', name: 'Шуруповёрт Makita DDF485', number: '№0087', category: 'Аккумуляторный', condition: 'ok', location: 'На руках · Смирнова Е. В.', updated: '02.10.2026', issued: true },
  { id: '4', name: 'Болгарка DeWalt DWE4157', number: '№0213', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж B3', updated: '02.10.2026', issued: false },
  { id: '5', name: 'Лазерный уровень GLL 3-80', number: '№0310', category: 'Измерительный', condition: 'ok', location: 'На руках · Васильев П. Н.', updated: '02.10.2026', issued: true },
  { id: '6', name: 'Рубанок Makita KP0800', number: '№0054', category: 'Электроинструмент', condition: 'broken', location: 'На месте · Зона ремонта', updated: '02.10.2026', issued: false },
  { id: '7', name: 'Набор свёрл Bosch, 19 шт.', number: '№0420', category: 'Оснастка', condition: 'inspection', location: 'На руках · Смирнова Е. В.', updated: '02.10.2026', issued: true },
  { id: '8', name: 'Лобзик Bosch PST 700', number: '№0166', category: 'Электроинструмент', condition: 'damaged', location: 'На месте · Стеллаж B1', updated: '02.10.2026', issued: false },
];


export async function getTools(): Promise<ToolRow[]> {
  await new Promise((r) => setTimeout(r, 300));
  return mockTools;
}

export function useTools() {
  return useQuery({
    queryKey: queryKeys.tools,
    queryFn: getTools,
  });
}