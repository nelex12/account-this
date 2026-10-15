// src/mock/overview.ts — mock responses of GET /api/tools, /api/users, /api/logs
// in the real API shapes. Log times are relative to "now", so the "today" counters are not empty.
import type { RentalLogEntry } from '../entities/journalModel';
import type { ApiTool, ApiUser } from '../api/overview';

const HOLDER = '5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21';
const ISSUER = '2a6f9d34-81c5-4b07-a3e2-6d5c7f1e9b08';

const tool = (condition: ApiTool['condition'], held = false): ApiTool => ({
  condition,
  holderId: held ? HOLDER : null,
});

/** 25 tools: 8 on hand, 4 damaged, 3 broken. */
export const mockApiTools: ApiTool[] = [
  ...Array.from({ length: 8 }, () => tool('Good', true)),
  ...Array.from({ length: 11 }, () => tool('Good')),
  ...Array.from({ length: 3 }, () => tool('Damaged')),
  tool('Damaged', true),
  ...Array.from({ length: 2 }, () => tool('Broken')),
  tool('Broken', true),
];

/** 3 access requests (not approved yet). */
export const mockApiUsers: ApiUser[] = [
  { isApproved: true, isActive: true },
  { isApproved: true, isActive: true },
  { isApproved: false, isActive: true },
  { isApproved: false, isActive: true },
  { isApproved: false, isActive: true },
  { isApproved: false, isActive: false }, // dismissed, does not count
];

const ago = (minutes: number) => Math.floor(Date.now() / 1000) - minutes * 60;

const log = (
  id: number,
  minutesAgo: number,
  action: RentalLogEntry['action'],
  toolName: string,
  workerName: string,
  toolCondition: RentalLogEntry['toolCondition'],
  validationFlag: RentalLogEntry['validationFlag'] = 'VALID',
): RentalLogEntry => ({
  id,
  toolId: '17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35',
  toolName,
  workerId: HOLDER,
  workerName,
  issuerId: ISSUER,
  action,
  toolCondition,
  qrTimestamp: ago(minutesAgo),
  scannedAt: ago(minutesAgo) + 5,
  validationFlag,
  createdAt: ago(minutesAgo) + 600,
});

/** Newest first, like the real endpoint. */
export const mockApiLogs: RentalLogEntry[] = [
  log(10, 5, 'GIVE', 'Перфоратор Bosch GBH 2-26', 'Иванов Иван Иванович', 'Good'),
  log(9, 30, 'TAKE', 'Шуруповёрт Makita DDF485', 'Смирнова Елена Викторовна', 'Good'),
  log(8, 65, 'GIVE', 'Болгарка DeWalt DWE4157', 'Кузнецов Дмитрий Александрович', 'Good'),
  log(7, 100, 'GIVE', 'Дрель Bosch SGB 235', 'Орлов Михаил Константинович', 'Damaged'),
  log(6, 140, 'TAKE', 'Лазерный уровень GLL 3-80', 'Васильев Павел Николаевич', 'Good', 'TIME_DRIFT'),
  log(5, 190, 'GIVE', 'Рубанок Makita KP0800', 'Новиков Сергей Романович', 'Broken'),
  log(4, 240, 'TAKE', 'Набор свёрл Bosch, 19 шт.', 'Смирнова Елена Викторовна', 'Good'),
  log(3, 60 * 26, 'GIVE', 'Лобзик Bosch PST 700', 'Козлов Тимофей Евгеньевич', 'Good'),
];