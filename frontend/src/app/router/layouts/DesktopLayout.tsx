// AppLayout.tsx
import type { ReactNode } from 'react';
import type { TopAppBarDesktopProps } from '../../../shared/ui/TopAppBar';
import Box from '@mui/material/Box';
import NavigationRail from '../../../shared/ui/NavigationRail';
import TopAppBar from '../../../shared/ui/TopAppBar';

interface DesktopLayoutProps {
  topBar: TopAppBarDesktopProps;
  children: ReactNode;
}

export default function DesktopLayout({ topBar, children }: DesktopLayoutProps) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavigationRail />

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopAppBar {...topBar} />

        <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}