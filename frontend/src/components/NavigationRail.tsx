import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';

export default function NavigationRail() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleListItemClick = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <Box
      sx={{
        width: '20vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* 1. Верхний блок — Логотип */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="div">
          LOGO
        </Typography>
      </Box>

      <Divider />

      {/* 2. Основной список кнопок */}
      <List component="nav" sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 0}
            onClick={() => handleListItemClick(0)}
          >
            <ListItemIcon>
              
            </ListItemIcon>
            <ListItemText primary="Обзор" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 1}
            onClick={() => handleListItemClick(1)}
          >
            <ListItemIcon>
              
            </ListItemIcon>
            <ListItemText primary="Инструменты" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 2}
            onClick={() => handleListItemClick(2)}
          >
            <ListItemIcon>
              
            </ListItemIcon>
            <ListItemText primary="Журнал" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 3}
            onClick={() => handleListItemClick(3)}
          >
            <ListItemIcon>
              
            </ListItemIcon>
            <ListItemText primary="Пользователи" />
          </ListItemButton>
        </ListItem>

        <Divider />

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 4}
            onClick={() => handleListItemClick(4)}
          >
            <ListItemIcon>
              
            </ListItemIcon>
            <ListItemText primary="Профиль" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}