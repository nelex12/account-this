// AppLayout.tsx
import type { ReactNode } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import NavigationRail from '../../../shared/ui/NavigationRail';
import NavigationBottom from '../../../shared/ui/NavigationBottom';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
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
        {children}
      </Box>

      {isMobile && <NavigationBottom />}
    </Box>
  );
}