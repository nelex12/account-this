// SimpleLayout.tsx — shell for Worker: top bar + page, no navigation.
// Navigation lives in the top bar: a profile button (everywhere except the
// profile itself) and a back button (everywhere except the overview).
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';

import { AccountCircleIcon } from '../../../shared/Icons';
import TopAppBar from '../../../shared/ui/TopAppBar';

import type { RouteHandle } from '../routes';
import { useGoBack } from '../useGoBack';

const HOME_PATH = '/overview';
const PROFILE_PATH = '/profile';

export default function SimpleLayout() {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isHome = pathname === HOME_PATH;
  const isProfile = pathname === PROFILE_PATH;

  const handleBack = useGoBack();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {handle?.topBar && (
        <TopAppBar
          {...handle.topBar}
          onBack={isHome ? undefined : handleBack}
          trailing={
            isProfile ? undefined : (
              <IconButton
                edge="end"
                aria-label="Профиль"
                onClick={() => navigate(PROFILE_PATH)}
              >
                <AccountCircleIcon fontSize="large" />
              </IconButton>
            )
          }
        />
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}