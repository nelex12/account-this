// NavigationBottom.tsx
import { useState } from 'react';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';

export default function NavigationBottom() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleListItemClick = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <BottomNavigation
        showLabels
        value={selectedIndex}
        onChange={(_, value: number) => handleListItemClick(value)}
      >
        <BottomNavigationAction label="Обзор" />
        <BottomNavigationAction label="Инструменты" />
        <BottomNavigationAction label="Журнал" />
        <BottomNavigationAction label="Профиль" />
      </BottomNavigation>
    </Paper>
  );
}