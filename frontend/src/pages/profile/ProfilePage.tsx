
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Logout from '@mui/icons-material/Logout';

/* ----------------------------------- Types ---------------------------------- */

export interface ProfileData {
  fullName: string;
  /** Normalized phone, e.g. "+79991234567" */
  phone: string;
  role: string;
  /** Mock only. Real app never has the password on the client. */
  password: string;
}

export interface ProfilePageProps {
  profile?: ProfileData;
  onLogout?: () => void;
}

const defaultProfile: ProfileData = {
  fullName: 'Петров Алексей Сергеевич',
  phone: '+79991234567',
  role: 'Владелец',
  password: 'securePassword123',
};

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

/* ----------------------------------- Page ----------------------------------- */

export default function ProfilePage({
  profile = defaultProfile,
  onLogout,
}: ProfilePageProps) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogout = () => {
    onLogout?.();
    navigate('/');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <Stack spacing={3} sx={{ p: { xs: 3, md: 4 } }}>
          {/* Avatar + name + role */}
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar sx={{ width: 96, height: 96, fontSize: 36, fontFamily: 'Montserrat' }}>
              {initials(profile.fullName)}
            </Avatar>
            <Typography variant="h5" component="h2">
              {profile.fullName}
            </Typography>
            <Chip size="small" label={profile.role} />
          </Stack>

          <Divider />

          {/* Read-only details */}
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Телефон"
              value={formatPhone(profile.phone)}
              slotProps={{ input: { readOnly: true } }}
            />

            <TextField
              fullWidth
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              value={profile.password}
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>

          <Divider />

          {/* Actions */}
          <Stack spacing={1.5}>
            <Button variant="outlined" size="large" fullWidth>
              Изменить пароль
            </Button>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<Logout />}
              onClick={handleLogout}
            >
              Выйти
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}