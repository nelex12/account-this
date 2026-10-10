// AppLayout.tsx
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import NavigationRail from './shared/ui/NavigationRail';
import NavigationBottom from './shared/ui/NavigationBottom';

export default function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && <NavigationRail />}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // leave room for the fixed bottom bar on mobile
          pb: isMobile ? 8 : 0,
        }}
      >
        <Outlet />
      </Box>

      {isMobile && <NavigationBottom />}
    </Box>
  );
}