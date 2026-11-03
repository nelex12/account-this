// OwnerShell.tsx — Owner works on a desktop only: below the minimum width
// show a stub instead of the layout (nothing else is mounted, no requests are made).
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useAuth } from '../../providers/AuthProvider';
import { LogoutIcon } from '../../../shared/Icons';
import DesktopLayout from './DesktopLayout';

/** 240px rail + 3 summary cards need about this much. Equals the MUI `lg` breakpoint. */
export const OWNER_MIN_WIDTH = 900; //1024 is default

function DesktopOnlyNotice() {
  const { logout } = useAuth();

  return (
    <Box
      role="alert"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" component="h1">
        Откройте на компьютере
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        Кабинет владельца рассчитан на большой экран. Войдите с компьютера
        или расширьте окно браузера: нужна ширина от {OWNER_MIN_WIDTH}&nbsp;px.
      </Typography>
      <Button variant="outlined" startIcon={<LogoutIcon />} onClick={() => void logout()}>
        Выйти
      </Button>
    </Box>
  );
}

export default function OwnerShell() {
  // noSsr: read the real width on the first render, so there is no flash of the broken layout
  const isWideEnough = useMediaQuery(`(min-width:${OWNER_MIN_WIDTH}px)`, { noSsr: true });

  return isWideEnough ? <DesktopLayout /> : <DesktopOnlyNotice />;
}