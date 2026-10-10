
import type { JournalRow } from "../entities/journalModel";

/** Default mock data — used when the caller doesn't provide `rows`. */
export const defaultJournalRows: JournalRow[] = [
  { id: '1', time: '02.10.2026 16:42', action: 'return', toolName: 'Перфоратор Bosch GBH 2-26', toolNumber: '№0142', employee: 'Иванов И. И.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '2', time: '02.10.2026 16:10', action: 'issue', toolName: 'Шуруповёрт Makita DDF485', toolNumber: '№0087', employee: 'Смирнова Е. В.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '3', time: '02.10.2026 15:35', action: 'return', toolName: 'Болгарка DeWalt DWE4157', toolNumber: '№0213', employee: 'Кузнецов Д. А.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '4', time: '02.10.2026 14:58', action: 'return', toolName: 'Дрель Bosch SGB 235', toolNumber: '№0001', employee: 'Орлов М. К.', declared: 'Царапины корпуса', acceptedBy: 'Петров А. С.' },
  { id: '5', time: '02.10.2026 14:20', action: 'issue', toolName: 'Лазерный уровень GLL 3-80', toolNumber: '№0310', employee: 'Васильев П. Н.', declared: 'Исправен', acceptedBy: '—' },
  { id: '6', time: '02.10.2026 13:47', action: 'return', toolName: 'Рубанок Makita KP0800', toolNumber: '№0054', employee: 'Новиков С. Р.', declared: 'Не включается', acceptedBy: 'Петров А. С.' },
  { id: '7', time: '02.10.2026 12:30', action: 'issue', toolName: 'Набор свёрл Bosch, 19 шт.', toolNumber: '№0420', employee: 'Смирнова Е. В.', declared: 'Комплект полный', acceptedBy: 'Петров А. С.' },
  { id: '8', time: '02.10.2026 11:05', action: 'return', toolName: 'Лобзик Bosch PST 700', toolNumber: '№0166', employee: 'Козлов Т. Е.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
];