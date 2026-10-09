// DesktopLayout.tsx
import { Outlet, useMatches } from 'react-router-dom';
import Box from '@mui/material/Box';
import NavigationRail from '../../../shared/ui/NavigationRail';
import TopAppBar from '../../../shared/ui/TopAppBar';
import type { RouteHandle } from '../routes';

export default function DesktopLayout() {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavigationRail />

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {handle?.topBar && <TopAppBar {...handle.topBar} />}

        <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}