// DesktopLayout.tsx
import { Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import NavigationRail from '../../../shared/ui/NavigationRail';
import TopAppBar from '../../../shared/ui/TopAppBar';
import { useGoBack } from '../useGoBack';
import { useTopBar } from '../useTopBar';

const HOME_PATH = '/overview';

export default function DesktopLayout() {
  const topBar = useTopBar();
  const { pathname } = useLocation();
  const goBack = useGoBack();

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavigationRail />

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {topBar && (
          <TopAppBar
            {...topBar}
            onBack={pathname === HOME_PATH ? undefined : goBack}
          />
        )}

        <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}