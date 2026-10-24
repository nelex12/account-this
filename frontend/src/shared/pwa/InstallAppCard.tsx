// InstallAppCard.tsx — a block for the profile page: install the app / how to install it.
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useInstallPrompt } from './useInstallPrompt';

export default function InstallAppCard() {
  const state = useInstallPrompt();

  if (state.kind === 'installed') {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        Приложение установлено на это устройство
      </Typography>
    );
  }
  if (state.kind === 'available') {
    return (
      <Stack spacing={1}>
        <Button variant="outlined" size="large" fullWidth onClick={() => void state.install()}>
          Установить приложение
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Откроется как обычное приложение, значок появится на главном экране
        </Typography>
      </Stack>
    );
  }
  if (state.kind === 'ios-hint') {
    return (
      <Alert severity="info">
        Чтобы установить приложение: нажмите «Поделиться» в Safari и выберите «На экран «Домой»».
      </Alert>
    );
  }
  return null;
}
