// src/pages/auth/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { ApiError } from '../../api/auth';
import { useAuth } from '../../app/providers/AuthProvider';
import type { Role } from '../../entities/authModel';

/** Passed by SignUpPage through router state after a successful registration. */
interface LoginLocationState {
  registered?: boolean;
  role?: Role;
}

/* ----------------------------------- Page ---------------------------------- */

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registration = (location.state as LoginLocationState | null) ?? null;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!phone.trim() || !password) {
      setError('Введите телефон и пароль');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(phone.trim(), password);
      navigate('/overview', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось войти. Попробуйте позже.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
          <form onSubmit={handleSubmit} noValidate>
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
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{ fontWeight: 'bold' }}
                  >
                    Вход
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Учет и выдача инструмента
                  </Typography>
                </Stack>
              </Box>

              {/* ПРАВАЯ КОЛОНКА: форма */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {registration?.registered && !error && (
                  <Alert severity="success">
                    {registration.role === 'Owner'
                      ? 'Регистрация прошла успешно. Войдите, используя телефон и пароль.'
                      : 'Регистрация прошла успешно. Войти можно после того, как владелец компании подтвердит ваш аккаунт.'}
                  </Alert>
                )}

                {error && <Alert severity="error">{error}</Alert>}

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    placeholder="+7 (000) 111-22-33"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (error) setError(null);
                    }}
                    autoComplete="tel"
                    variant="outlined"
                  />

                  <TextField
                    fullWidth
                    type="password"
                    label="Пароль"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    autoComplete="current-password"
                    variant="outlined"
                  />
                </Stack>

                <Stack spacing={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={isSubmitting}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : null
                    }
                  >
                    {isSubmitting ? 'Вход...' : 'Войти'}
                  </Button>

                  <Typography
                    variant="body2"
                    align="center"
                    color="text.secondary"
                  >
                    Нет аккаунта?{' '}
                    <Link
                      component={RouterLink}
                      to="/register"
                      underline="hover"
                      sx={{ fontWeight: 500 }}
                    >
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