// src/pages/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth, type Role } from '../../app/providers/AuthProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Link,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

/* --------------------------------- Dev stub -------------------------------- */

interface DevRole {
  value: Role;
  label: string;
  hint: string;
}

const DEV_ROLES: DevRole[] = [
  { value: 'Owner',  label: 'Владелец',  hint: 'Desktop-раскладка · rail слева' },
  { value: 'Issuer', label: 'Заведующий', hint: 'Mobile-раскладка · bottom nav' },
  { value: 'Worker', label: 'Сотрудник', hint: 'Simple-раскладка · без навигации' },
];

/* ----------------------------------- Page ---------------------------------- */

export default function LoginPage() {
  const { loginAs } = useAuth();
  const [devRole, setDevRole] = useState<Role>('Owner');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // DEV STUB — replace with a real credential check + auth API call.
    // For now the button just signs you in as the selected role so you can
    // verify all three layouts and the RoleGuard wiring end-to-end.
    loginAs(devRole);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'action.hover',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 900, width: '100%', borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <form onSubmit={handleSubmit}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 4,
              }}
            >
              {/* ЛЕВАЯ КОЛОНКА: логотип, заголовок */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ fontWeight: 'bold' }}
                  >
                    ACCOUNT THIS!
                  </Typography>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                    Вход
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Учет и выдача инструмента
                  </Typography>
                </Stack>
              </Box>

              {/* ПРАВАЯ КОЛОНКА: форма + dev-переключатель роли */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <Typography variant="body1">Заполните данные</Typography>

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    placeholder="+7 (000) 111-22-33"
                    helperText="Введите номер телефона"
                    variant="outlined"
                  />

                  <TextField
                    fullWidth
                    type="password"
                    label="Пароль"
                    placeholder="••••••••••"
                    helperText="Не менее 8 символов"
                    variant="outlined"
                  />
                </Stack>

                {/* DEV: выбор роли для входа без бэкенда */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Режим разработки — выбор роли
                  </Typography>

                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={devRole}
                    onChange={(_, value: Role | null) => {
                      if (value) setDevRole(value);
                    }}
                    sx={{ mt: 0.5 }}
                  >
                    {DEV_ROLES.map((role) => (
                      <ToggleButton key={role.value} value={role.value}>
                        {role.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    {DEV_ROLES.find((r) => r.value === devRole)?.hint}
                  </Typography>
                </Box>

                {/* Нижний блок: кнопка и переадресация */}
                <Stack spacing={2}>
                  <Button type="submit" variant="contained" size="large" fullWidth>
                    Войти
                  </Button>

                  <Typography variant="body2" align="center" color="text.secondary">
                    Нет аккаунта?{' '}
                    <Link href="/register" underline="hover" sx={{ fontWeight: 500 }}>
                      Зарегистрироваться
                    </Link>
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}