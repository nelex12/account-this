// src/api/profile.ts
import { useQuery } from '@tanstack/react-query';
import type { ProfileData } from '../entities/profileModel';
import { queryKeys } from './queryKeys';

/* --------------------------------- Mocks ----------------------------------- */

const mockProfile: ProfileData = {
  fullName: 'Петров Алексей Сергеевич',
  phone: '+79991234567',
  role: 'Владелец',
  password: 'securePassword123',
};

/* ------------------------------- Raw functions ------------------------------ */

/**
 * Replace with a real request when the backend is ready:
 *   const res = await fetch('/api/profile');
 *   if (!res.ok) throw new Error('Не удалось загрузить профиль');
 *   return res.json();
 */
export async function getProfile(): Promise<ProfileData> {
  await new Promise((r) => setTimeout(r, 300));
  return mockProfile;
}

/* ---------------------------------- Hooks ----------------------------------- */

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: getProfile,
  });
}