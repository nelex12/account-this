import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Link,
  Stack,
  FormControl,
  FormLabel,
  Divider,
} from '@mui/material';

export default function SignUpPage() {
  const [role, setRole] = useState('Worker');

  const handleRoleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRole(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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
      {/* Главный контейнер для всей формы */}
      <Card sx={{ maxWidth: 900, width: '100%', borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <form onSubmit={handleSubmit}>
            {/* Ряд с двумя колонками (Row Container) */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 4,
              }}
            >
              {/* ЛЕВАЯ КОЛОНКА: Логотип, Заголовок и 4 Поля */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                    ACCOUNT THIS!
                  </Typography>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                    Регистрация
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Заявку рассмотрит владелец
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  {/* 1. Поле ФИО */}
                  <TextField
                    fullWidth
                    label="ФИО"
                    placeholder="Иван Иванович Иванов"
                    helperText="Фамилия, имя и отчество"
                    variant="outlined"
                  />

                  {/* 2. Поле Телефон */}
                  <TextField
                    fullWidth
                    label="Телефон"
                    placeholder="+7 (000) 111-22-33"
                    helperText="Для входа и уведомлений"
                    variant="outlined"
                  />

                  {/* 3. Поле Пароль */}
                  <TextField
                    fullWidth
                    type="password"
                    label="Пароль"
                    placeholder="••••••••••"
                    helperText="Не менее 8 символов"
                    variant="outlined"
                  />

                  {/* 4. Поле Повторите пароль */}
                  <TextField
                    fullWidth
                    type="password"
                    label="Повторите пароль"
                    placeholder="••••••••••"
                    helperText="Пароли должны совпадать"
                    variant="outlined"
                  />
                </Stack>
              </Box>

              {/* Вертикальный разделитель между колонками (только на десктопе) */}
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

              {/* ПРАВАЯ КОЛОНКА: Выбор роли, Кнопка и Ссылка */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Выбор роли */}
                <FormControl component="fieldset">
                  <FormLabel id="role-radio-group-label" sx={{ mb: 1.5, fontWeight: 500 }}>
                    Роль
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="role-radio-group-label"
                    name="role"
                    value={role}
                    onChange={handleRoleChange}
                  >
                    <Stack spacing={1.5}>
                      {/* Сотрудник */}
                      <FormControlLabel
                        value="Worker"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2">Сотрудник</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Беру и возвращаю инструмент по QR-коду
                            </Typography>
                          </Box>
                        }
                      />

                      {/* Заведующий */}
                      <FormControlLabel
                        value="Issuer"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2">Заведующий</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Выдаю и принимаю инструмент, веду реестр
                            </Typography>
                          </Box>
                        }
                      />

                      {/* Владелец */}
                      <FormControlLabel
                        value="Owner"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2">Владелец</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Подтверждаю заявки, управляю людьми и списанием
                            </Typography>
                          </Box>
                        }
                      />
                    </Stack>
                  </RadioGroup>
                </FormControl>

                {/* Нижний блок: Кнопка и переадресация */}
                <Stack spacing={2} sx={{ mt: { xs: 3, md: 0 } }}>
                  <Button type="submit" variant="contained" size="large" fullWidth>
                    Отправить заявку
                  </Button>

                  <Typography variant="body2" align="center" color="text.secondary">
                    Уже есть аккаунт?{' '}
                    <Link href="/" underline="hover" sx={{ fontWeight: 500 }}>
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