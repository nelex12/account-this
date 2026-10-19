// MobileLayout.tsx
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import NavigationBottom from '../../../shared/ui/NavigationBottom';
import TopAppBar from '../../../shared/ui/TopAppBar';
import { useTopBar } from '../useTopBar';

export default function MobileLayout() {
  const topBar = useTopBar();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {topBar && <TopAppBar {...topBar} />}

      <Box component="main" sx={{ pb: 8 }}>
        <Outlet />
      </Box>

      <NavigationBottom />
    </Box>
  );
}