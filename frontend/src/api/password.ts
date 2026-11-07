// src/api/password.ts
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../app/providers/AuthProvider';

/**
 * Change the signed-in user's password (POST /api/auth/change-password).
 * Goes through AuthProvider so the new access token is stored like after login.
 * On failure the error is an ApiError: `fieldErrors.currentPassword` / `fieldErrors.newPassword`
 * for 400, a plain message for 403 and everything else.
 */
export function useChangePassword() {
  const { changePassword } = useAuth();

  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword(currentPassword, newPassword),
  });
}
