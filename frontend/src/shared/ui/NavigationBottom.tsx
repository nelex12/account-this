
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';

import { navItems } from './navItems';

export default function NavigationBottom() {

  const bottomItems = navItems.filter(i => i.path !== '/users'); // на мобильном 4 пункта

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = bottomItems.find(i => pathname.startsWith(i.path))?.path ?? false;

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        pb: 'env(safe-area-inset-bottom)'
      }}
    >
      <BottomNavigation showLabels value={current} onChange={(_, value: string) => navigate(value)}>
        {bottomItems.map(({ label, path, icon }) => (
          <BottomNavigationAction key={path} label={label} value={path} icon={icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}