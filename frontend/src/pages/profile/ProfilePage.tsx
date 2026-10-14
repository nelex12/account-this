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

import { LogoutIcon, PersonIcon } from '../../shared/Icons';
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

/**
 * Profile of the signed-in user. Role comes from the JWT; name, phone and
 * company are assembled by `useProfile` from whatever the API provides for the
 * role (see api/profile.ts). Fields the backend cannot give are hidden.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: profile, isLoading } = useProfile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      // POST /api/auth/logout (204, cookie cleared server-side). The provider
      // clears the local session in a `finally`, so a network error still
      // leaves us signed out locally.
      await logout();
    } catch {
      // Nothing to show: the local session is already gone.
    }
    navigate('/login', { replace: true });
  };

  const fullName = profile?.fullName || user?.fullName || '';
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <Stack spacing={3} sx={{ p: { xs: 3, md: 4 } }}>
          {/* Avatar + name + role */}
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar sx={{ width: 96, height: 96, fontSize: 36 }}>
              {fullName ? initials(fullName) : <PersonIcon fontSize="large" />}
            </Avatar>
            <Typography variant="h5" component="h2">
              {fullName || 'Профиль'}
            </Typography>
            {roleLabel && <Chip size="small" label={roleLabel} />}
          </Stack>

          <Divider />

          {/* Read-only details; only what the backend can provide for this role */}
          <Stack spacing={2}>
            {isLoading ? (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : (
              <>
                {profile?.phone && (
                  <TextField
                    fullWidth
                    label="Телефон"
                    value={formatPhone(profile.phone)}
                    slotProps={{ input: { readOnly: true } }}
                  />
                )}
                {profile?.companyName && (
                  <TextField
                    fullWidth
                    label="Компания"
                    value={profile.companyName}
                    slotProps={{ input: { readOnly: true } }}
                  />
                )}
              </>
            )}
          </Stack>

          <Divider />

          {/* Actions */}
          <Stack spacing={1.5}>
            {/* The API has no change-password endpoint yet */}
            <Button variant="outlined" size="large" fullWidth disabled>
              Изменить пароль
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Смена пароля пока недоступна
            </Typography>

            <Button
              variant="contained"
              size="large"
              fullWidth
              color="error"
              startIcon={
                isLoggingOut ? <CircularProgress size={18} color="inherit" /> : <LogoutIcon />
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