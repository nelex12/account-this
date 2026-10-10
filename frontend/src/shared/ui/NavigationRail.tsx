import { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';

import { HomeIcon,
  BuildIcon, 
  ListAltIcon, 
  GroupIcon, 
  PersonIcon 
} from '../Icons';

export default function NavigationRail() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Return this!!
  // const handleListItemClick = (index: number) => {
  //   setSelectedIndex(index);
  // };
  const handleListItemClick = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        alignSelf: 'stretch',      // fills parent's height instead of hard 100vh
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* 1. Верхний блок — Логотип */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="div">
          Account This!
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
              <HomeIcon />
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
              <BuildIcon />
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
              <ListAltIcon />
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
              <GroupIcon />
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
              <PersonIcon />
            </ListItemIcon>
            <ListItemText primary="Профиль" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}