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

export default function LoginPage() {
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
                    Вход
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Учет и выдача инструмента
                  </Typography>
                </Stack>
              </Box>

              {/* Вертикальный разделитель между колонками (только на десктопе) */}
              {/*
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
              */}

              {/* ПРАВАЯ КОЛОНКА: Выбор роли, Кнопка и Ссылка */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >

                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant="body1" >
                    Заполните данные
                  </Typography>
                </Stack>

                <Stack>
                  {/* 2. Поле Телефон */}
                  <TextField
                    fullWidth
                    label="Телефон"
                    placeholder="+7 (000) 111-22-33"
                    helperText="Введите номер телефона"
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
                </Stack>

                {/* Нижний блок: Кнопка и переадресация */}
                <Stack spacing={2} sx={{ mt: { xs: 3, md: 0 } }}>
                  <Button type="submit" variant="contained" size="large" fullWidth>
                    Войти
                  </Button>

                  <Typography variant="body2" align="center" color="text.secondary">
                    Нет аккаунта?{' '}
                    <Link href="/" underline="hover" sx={{ fontWeight: 500 }}>
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