// ProfilePage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Logout from '@mui/icons-material/Logout';

import { useProfile } from '../../api';
import { useAuth } from '../../app/providers/AuthProvider';

/* --------------------------------- Helpers ---------------------------------- */

/** "+79991234567" -> "+7 (999) 123-45-67" */
function formatPhone(phone: string): string {
  const m = phone.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : phone;
}

/** "Петров Алексей Сергеевич" -> "ПА" */
function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Role code -> human-readable label */
const ROLE_LABELS: Record<string, string> = {
  Owner: 'Владелец',
  Issuer: 'Заведующий',
  Worker: 'Сотрудник',
};

/* ----------------------------------- Page ----------------------------------- */

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Phone etc. still comes from the mock/API. Name and role come from the JWT
  // (see `useAuth`) so the page stays in sync with the actual signed-in user.
  const { data: profile, isLoading, isError, error } = useProfile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      // Hits POST /api/auth/logout (204, cookie cleared server-side).
      // AuthProvider clears the in-memory access token in a `finally`,
      // so even a network error leaves us safely signed out locally.
      await logout();
      navigate('/login', { replace: true });
    } catch {
      // The provider already cleared local state; only surface a hint.
      setLogoutError('Сессия завершена локально, но сервер не ответил.');
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Source of truth for identity: the decoded JWT.
  const fullName = user?.fullName || profile?.fullName || '';
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <Stack spacing={3} sx={{ p: { xs: 3, md: 4 } }}>
          {/* Avatar + name + role */}
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar sx={{ width: 96, height: 96, fontSize: 36 }}>
              {fullName ? initials(fullName) : '?'}
            </Avatar>
            <Typography variant="h5" component="h2">
              {fullName || 'Профиль'}
            </Typography>
            {roleLabel && <Chip size="small" label={roleLabel} />}
          </Stack>

          <Divider />

          {/* Read-only details (phone comes from the profile endpoint) */}
          <Stack spacing={2}>
            {isLoading ? (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : isError || !profile ? (
              <Typography color="error" variant="body2">
                Не удалось загрузить контактные данные
                {error instanceof Error ? `: ${error.message}` : ''}
              </Typography>
            ) : (
              <TextField
                fullWidth
                label="Телефон"
                value={formatPhone(profile.phone)}
                slotProps={{ input: { readOnly: true } }}
              />
            )}
          </Stack>

          <Divider />

          {/* Actions */}
          <Stack spacing={1.5}>
            {logoutError && (
              <Typography color="warning.main" variant="caption">
                {logoutError}
              </Typography>
            )}

            <Button variant="outlined" size="large" fullWidth disabled={isLoggingOut}>
              Изменить пароль
            </Button>

            <Button
              variant="contained"
              size="large"
              fullWidth
              color="error"
              startIcon={
                isLoggingOut ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <Logout />
                )
              }
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? 'Выход...' : 'Выйти'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}