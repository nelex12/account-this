// src/app/router/layouts/NavigationBottom.tsx
import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import { useNavItems } from '../useNavItems';

export default function NavigationBottom() {
  const items = useNavItems({ forBottomNav: true });
  const { pathname } = useLocation();

  // Find the currently-active item, so the dot/highlight follows the URL.
  const activeIndex = items.findIndex((item) => pathname.startsWith(item.path));

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        pb: 'env(safe-area-inset-bottom)',
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <BottomNavigation showLabels value={activeIndex === -1 ? false : activeIndex}>
        {items.map((item) => (
          <BottomNavigationAction
            key={item.path}
            component={NavLink}
            to={item.path}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}