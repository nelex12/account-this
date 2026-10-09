// MobileLayout.tsx
import { Outlet, useMatches } from 'react-router-dom';
import Box from '@mui/material/Box';
import NavigationBottom from '../../../shared/ui/NavigationBottom';
import TopAppBar from '../../../shared/ui/TopAppBar';
import type { RouteHandle } from '../routes';

export default function MobileLayout() {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {handle?.topBar && <TopAppBar {...handle.topBar} />}

      <Box component="main" sx={{ pb: 8 }}>
        <Outlet />
      </Box>

      <NavigationBottom />
    </Box>
  );
}