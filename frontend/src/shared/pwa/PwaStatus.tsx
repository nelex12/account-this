// PwaStatus.tsx — service worker messages for the user (mounted once, in main.tsx):
//   * "ready offline" — the first time everything is cached;
//   * "new version"   — a new build is downloaded and waits; it is applied only on "Обновить",
//                       so a scan or a QR on screen is never interrupted.
// The worker is checked for a new version every hour while the app stays open.
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60_000;

export default function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        // a request while offline would only fail
        if (navigator.onLine) void registration.update().catch(() => {});
      }, CHECK_EVERY_MS);
    },
  });

  return (
    <>
      <Snackbar
        open={needRefresh}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88 } }} // above the bottom navigation
      >
        <Alert
          severity="info"
          variant="filled"
          action={
            <>
              <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
                Позже
              </Button>
              <Button color="inherit" size="small" onClick={() => void updateServiceWorker(true)}>
                Обновить
              </Button>
            </>
          }
        >
          Доступна новая версия
        </Alert>
      </Snackbar>
      <Snackbar
        open={offlineReady && !needRefresh}
        autoHideDuration={5000}
        onClose={() => setOfflineReady(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88 } }}
      >
        <Alert severity="success" variant="filled" onClose={() => setOfflineReady(false)}>
          Приложение готово к работе без интернета
        </Alert>
      </Snackbar>
    </>
  );
}
