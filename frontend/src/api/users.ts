// src/api/users.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRow } from '../entities/usersModel';
import { queryKeys } from './queryKeys';

/* --------------------------------- Mocks ----------------------------------- */

const mockUsers: UserRow[] = [
  { id: '1',  applicant: 'Иванов И. И.',    phone: '+7 900 123-45-67', role: 'сотрудник',  status: 'ожидает',   requestedAt: '01.10.2026' },
  { id: '2',  applicant: 'Петров П. П.',    phone: '+7 900 234-56-78', role: 'заведующий', status: 'одобрена',  requestedAt: '02.10.2026' },
  { id: '3',  applicant: 'Сидоров С. С.',   phone: '+7 900 345-67-89', role: 'владелец',   status: 'отклонена', requestedAt: '02.10.2026' },
  { id: '4',  applicant: 'Кузнецова А. А.', phone: '+7 900 456-78-90', role: 'сотрудник',  status: 'ожидает',   requestedAt: '03.10.2026' },
  { id: '5',  applicant: 'Смирнова Е. В.',  phone: '+7 900 567-89-01', role: 'сотрудник',  status: 'одобрена',  requestedAt: '03.10.2026' },
  { id: '6',  applicant: 'Кузнецов Д. А.',  phone: '+7 900 678-90-12', role: 'заведующий', status: 'отклонена', requestedAt: '04.10.2026' },
  { id: '7',  applicant: 'Орлов М. К.',     phone: '+7 900 789-01-23', role: 'сотрудник',  status: 'ожидает',   requestedAt: '05.10.2026' },
  { id: '8',  applicant: 'Васильев П. Н.',  phone: '+7 900 890-12-34', role: 'владелец',   status: 'одобрена',  requestedAt: '06.10.2026' },
  { id: '9',  applicant: 'Новиков С. Р.',   phone: '+7 900 901-23-45', role: 'сотрудник',  status: 'отклонена', requestedAt: '06.10.2026' },
  { id: '10', applicant: 'Козлов Т. Е.',    phone: '+7 900 012-34-56', role: 'заведующий', status: 'ожидает',   requestedAt: '07.10.2026' },
];

/* ------------------------------- Raw functions ------------------------------ */

export async function getUsers(): Promise<UserRow[]> {
  await new Promise((r) => setTimeout(r, 300));
  return mockUsers;
}

/** TODO: replace with `POST /api/users/:id/accept` */
export async function acceptUser(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  console.log('acceptUser', id);
}

/** TODO: replace with `POST /api/users/:id/decline` */
export async function declineUser(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  console.log('declineUser', id);
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: getUsers,
  });
}

export function useAcceptUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useDeclineUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}