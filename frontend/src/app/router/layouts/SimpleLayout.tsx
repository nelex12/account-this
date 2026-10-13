// SimpleLayout.tsx
import { Outlet, useMatches } from 'react-router-dom';

import Box from '@mui/material/Box';
import TopAppBar from '../../../shared/ui/TopAppBar';

import type { RouteHandle } from '../routes';

export default function SimpleLayout() {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {handle?.topBar && <TopAppBar {...handle.topBar} />}

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
}