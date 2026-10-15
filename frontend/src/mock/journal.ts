// src/mock/journal.ts — mock of GET /api/logs, in the real response shape (RentalLogEntry).
import type { RentalLogEntry } from '../entities/journalModel';

const ISSUER = '2a6f9d34-81c5-4b07-a3e2-6d5c7f1e9b08';

// Unix seconds for 02.10.2026 at HH:mm UTC
const t = (h: number, m: number) => Date.UTC(2026, 9, 2, h, m) / 1000;

const entry = (
  id: number,
  action: RentalLogEntry['action'],
  toolName: string,
  toolId: string | null,
  workerName: string,
  toolCondition: RentalLogEntry['toolCondition'],
  at: number,
  validationFlag: RentalLogEntry['validationFlag'] = 'VALID',
): RentalLogEntry => ({
  id,
  toolId,
  toolName,
  workerId: validationFlag === 'UNKNOWN_WORKER' ? null : '5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21',
  workerName,
  issuerId: ISSUER,
  action,
  toolCondition,
  qrTimestamp: at,
  scannedAt: at + 5,
  validationFlag,
  createdAt: at + 600,
});

const id = (n: number) => `17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f${String(n).padStart(2, '0')}`;

/** Newest first, like the real endpoint. */
export const mockLogEntries: RentalLogEntry[] = [
  entry(8, 'GIVE', 'Перфоратор Bosch GBH 2-26', id(42), 'Иванов Иван Иванович', 'Good', t(16, 42)),
  entry(7, 'TAKE', 'Шуруповёрт Makita DDF485', id(87), 'Смирнова Елена Викторовна', 'Good', t(16, 10)),
  entry(6, 'GIVE', 'Болгарка DeWalt DWE4157', id(13), 'Кузнецов Дмитрий Александрович', 'Good', t(15, 35)),
  entry(5, 'GIVE', 'Дрель Bosch SGB 235', id(1), 'Орлов Михаил Константинович', 'Damaged', t(14, 58)),
  entry(4, 'TAKE', 'Лазерный уровень GLL 3-80', id(10), 'Васильев Павел Николаевич', 'Good', t(14, 20), 'TIME_DRIFT'),
  entry(3, 'GIVE', 'Рубанок Makita KP0800', id(54), 'Новиков Сергей Романович', 'Broken', t(13, 47)),
  entry(2, 'TAKE', 'Набор свёрл Bosch, 19 шт.', null, 'Смирнова Елена Викторовна', 'Good', t(12, 30), 'UNKNOWN_TOOL'),
  entry(1, 'GIVE', 'Лобзик Bosch PST 700', id(66), 'Козлов Тимофей Евгеньевич', 'Good', t(11, 5)),
];