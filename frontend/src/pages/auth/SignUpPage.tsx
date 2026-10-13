// src/pages/auth/SignUpPage.tsx
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { ApiError, useRegister, type RegisterPayload } from '../../api/auth';
import type { Role } from '../../app/providers/AuthProvider';

/* --------------------------------- Types ---------------------------------- */

type TextFieldName =
  | 'fullName'
  | 'phone'
  | 'password'
  | 'confirmPassword'
  | 'companyName'
  | 'companyId';

interface FormState {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: Role;
  companyName: string;
  companyId: string;
}

interface RoleOption {
  value: Role;
  label: string;
  hint: string;
}

/* --------------------------------- Config --------------------------------- */

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'Worker',
    label: 'Сотрудник',
    hint: 'Беру и возвращаю инструмент по QR-коду',
  },
  {
    value: 'Issuer',
    label: 'Заведующий',
    hint: 'Выдаю и принимаю инструмент, веду реестр',
  },
  {
    value: 'Owner',
    label: 'Владелец',
    hint: 'Подтверждаю заявки, управляю людьми и списанием',
  },
];

const initialState: FormState = {
  fullName: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'Worker',
  companyName: '',
  companyId: '',
};

/* ----------------------------------- Page --------------------------------- */

export default function SignUpPage() {
  const navigate = useNavigate();
  const register = useRegister();

  const [form, setForm] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [commonError, setCommonError] = useState<string | null>(null);

  const isOwner = form.role === 'Owner';

  /* ------------------------------ field utils ----------------------------- */

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setCommonError(null);
  };

  const handleTextChange =
    (field: TextFieldName) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      clearFieldError(field);
    };

  const handleRoleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, role: event.target.value as Role }));
    clearFieldError('role');
    clearFieldError('companyName');
    clearFieldError('companyId');
  };

  /* -------------------------------- submit -------------------------------- */

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setCommonError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = 'Укажите ФИО';
    else if (form.fullName.trim().length > 100)
      nextErrors.fullName = 'Не более 100 символов';

    if (!form.phone.trim()) nextErrors.phone = 'Укажите телефон';

    if (!form.password) nextErrors.password = 'Укажите пароль';
    else if (form.password.length < 8)
      nextErrors.password = 'Не менее 8 символов';

    if (!form.confirmPassword)
      nextErrors.confirmPassword = 'Повторите пароль';
    else if (form.password !== form.confirmPassword)
      nextErrors.confirmPassword = 'Пароли не совпадают';

    if (form.role === 'Owner') {
      if (!form.companyName.trim())
        nextErrors.companyName = 'Укажите название компании';
      else if (form.companyName.trim().length > 100)
        nextErrors.companyName = 'Не более 100 символов';
    } else if (!form.companyId.trim()) {
      nextErrors.companyId = 'Укажите ID компании';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const { fullName, phone, password, role } = form;
    const base = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      password,
    };

    const payload: RegisterPayload =
      role === 'Owner'
        ? { ...base, role: 'Owner', companyName: form.companyName.trim() }
        : { ...base, role, companyId: form.companyId.trim() };

    try {
      await register.mutateAsync(payload);
      navigate('/login', {
        replace: true,
        state: { registered: true },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setFieldErrors((prev) => ({ ...prev, phone: error.message }));
          return;
        }

        if (error.fieldErrors) {
          const fromServer: Record<string, string> = {};
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            if (Array.isArray(messages) && messages.length > 0) {
              fromServer[field] = messages[0];
            }
          }
          setFieldErrors(fromServer);
          return;
        }

        setCommonError(error.message);
        return;
      }

      setCommonError('Не удалось зарегистрироваться. Попробуйте позже.');
    }
  };

  /* --------------------------------- render ------------------------------- */

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
              {/* ЛЕВАЯ КОЛОНКА: логотип, заголовок, 4 поля */}
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
                    Регистрация
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isOwner
                      ? 'Создайте компанию и аккаунт владельца'
                      : 'Заявку рассмотрит владелец'}
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="ФИО"
                    placeholder="Иван Иванович Иванов"
                    value={form.fullName}
                    onChange={handleTextChange('fullName')}
                    error={Boolean(fieldErrors.fullName)}
                    helperText={
                      fieldErrors.fullName ?? 'Фамилия, имя и отчество'
                    }
                    sx={{ maxLength: 100 }}
                    autoComplete="name"
                    variant="outlined"
                  />

                  <TextField
                    fullWidth
                    label="Телефон"
                    placeholder="+7 (000) 111-22-33"
                    value={form.phone}
                    onChange={handleTextChange('phone')}
                    error={Boolean(fieldErrors.phone)}
                    helperText={
                      fieldErrors.phone ?? 'Для входа и уведомлений'
                    }
                    autoComplete="tel"
                    variant="outlined"
                  />

                  <TextField
                    fullWidth
                    type="password"
                    label="Пароль"
                    placeholder="••••••••••"
                    value={form.password}
                    onChange={handleTextChange('password')}
                    error={Boolean(fieldErrors.password)}
                    helperText={
                      fieldErrors.password ?? 'Не менее 8 символов'
                    }
                    autoComplete="new-password"
                    variant="outlined"
                  />

                  <TextField
                    fullWidth
                    type="password"
                    label="Повторите пароль"
                    placeholder="••••••••••"
                    value={form.confirmPassword}
                    onChange={handleTextChange('confirmPassword')}
                    error={Boolean(fieldErrors.confirmPassword)}
                    helperText={
                      fieldErrors.confirmPassword ?? 'Пароли должны совпадать'
                    }
                    autoComplete="new-password"
                    variant="outlined"
                  />
                </Stack>
              </Box>

              {/* Вертикальный разделитель между колонками (только desktop) */}
              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: 'none', md: 'block' } }}
              />

              {/* ПРАВАЯ КОЛОНКА: роль, поле компании, кнопка и ссылка */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {commonError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {commonError}
                  </Alert>
                )}

                {/* Выбор роли */}
                <FormControl component="fieldset">
                  <FormLabel
                    id="role-radio-group-label"
                    sx={{ mb: 1.5, fontWeight: 500 }}
                  >
                    Роль
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="role-radio-group-label"
                    name="role"
                    value={form.role}
                    onChange={handleRoleChange}
                  >
                    <Stack spacing={1.5}>
                      {ROLE_OPTIONS.map((role) => (
                        <FormControlLabel
                          key={role.value}
                          value={role.value}
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="subtitle2">
                                {role.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {role.hint}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </Stack>
                  </RadioGroup>
                </FormControl>

                {/* Поле компании: имя для Owner, id для остальных */}
                <Box sx={{ mt: 2 }}>
                  {isOwner ? (
                    <TextField
                      fullWidth
                      label="Название компании"
                      placeholder="ООО Ромашка"
                      value={form.companyName}
                      onChange={handleTextChange('companyName')}
                      error={Boolean(fieldErrors.companyName)}
                      helperText={
                        fieldErrors.companyName ?? 'Не более 100 символов'
                      }
                      sx={{ maxLength: 100 }}
                      variant="outlined"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label="ID компании"
                      placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                      value={form.companyId}
                      onChange={handleTextChange('companyId')}
                      error={Boolean(fieldErrors.companyId)}
                      helperText={
                        fieldErrors.companyId ??
                        'UUID компании, который выдал владелец'
                      }
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Нижний блок: кнопка и ссылка */}
                <Stack spacing={2} sx={{ mt: { xs: 3, md: 3 } }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={register.isPending}
                    startIcon={
                      register.isPending ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : null
                    }
                  >
                    {register.isPending
                      ? 'Отправка...'
                      : 'Отправить заявку'}
                  </Button>

                  <Typography
                    variant="body2"
                    align="center"
                    color="text.secondary"
                  >
                    Уже есть аккаунт?{' '}
                    <Link
                      component={RouterLink}
                      to="/login"
                      underline="hover"
                      sx={{ fontWeight: 500 }}
                    >
                      Войти
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