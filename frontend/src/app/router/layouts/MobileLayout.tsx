// MobileLayout.tsx
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import NavigationBottom, { BOTTOM_NAV_HEIGHT } from '../../../shared/ui/NavigationBottom';
import TopAppBar from '../../../shared/ui/TopAppBar';
import { useTopBar } from '../useTopBar';

export default function MobileLayout() {
  const topBar = useTopBar();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {topBar && <TopAppBar {...topBar} />}

      {/* Bottom padding = fixed bottom navigation, so content is never hidden under it */}
      <Box
        component="main"
        sx={{ pb: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
      >
        <Outlet />
      </Box>

      <NavigationBottom />
    </Box>
  );
}