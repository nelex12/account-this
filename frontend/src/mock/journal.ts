// src/mock/journal.ts
import type { JournalRow, Condition } from '../entities/journalModel';

const ok: Condition = { label: 'Исправен', color: 'success' };
const scratched: Condition = { label: 'Царапины корпуса', color: 'warning' };
const broken: Condition = { label: 'Не включается', color: 'error' };
const full: Condition = { label: 'Комплект полный', color: 'success' };

export const defaultJournalRows: JournalRow[] = [
  { id: '1', time: '02.10.2026 16:42', action: 'return', toolName: 'Перфоратор Bosch GBH 2-26', toolNumber: '№0142', employee: 'Иванов И. И.',   condition: ok,        acceptedBy: 'Петров А. С.' },
  { id: '2', time: '02.10.2026 16:10', action: 'issue',  toolName: 'Шуруповёрт Makita DDF485', toolNumber: '№0087', employee: 'Смирнова Е. В.', condition: ok,        acceptedBy: 'Петров А. С.' },
  { id: '3', time: '02.10.2026 15:35', action: 'return', toolName: 'Болгарка DeWalt DWE4157', toolNumber: '№0213', employee: 'Кузнецов Д. А.', condition: ok,        acceptedBy: 'Петров А. С.' },
  { id: '4', time: '02.10.2026 14:58', action: 'return', toolName: 'Дрель Bosch SGB 235', toolNumber: '№0001', employee: 'Орлов М. К.',    condition: scratched, acceptedBy: 'Петров А. С.' },
  { id: '5', time: '02.10.2026 14:20', action: 'issue',  toolName: 'Лазерный уровень GLL 3-80', toolNumber: '№0310', employee: 'Васильев П. Н.', condition: ok,        acceptedBy: '—' },
  { id: '6', time: '02.10.2026 13:47', action: 'return', toolName: 'Рубанок Makita KP0800', toolNumber: '№0054', employee: 'Новиков С. Р.',  condition: broken,    acceptedBy: 'Петров А. С.' },
  { id: '7', time: '02.10.2026 12:30', action: 'issue',  toolName: 'Набор свёрл Bosch, 19 шт.', toolNumber: '№0420', employee: 'Смирнова Е. В.', condition: full,      acceptedBy: 'Петров А. С.' },
  { id: '8', time: '02.10.2026 11:05', action: 'return', toolName: 'Лобзик Bosch PST 700', toolNumber: '№0166', employee: 'Козлов Т. Е.',   condition: ok,        acceptedBy: 'Петров А. С.' },
];