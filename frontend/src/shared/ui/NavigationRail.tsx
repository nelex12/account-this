// src/app/router/layouts/NavigationRail.tsx
import {
  Box, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText,
} from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import { useNavItems } from '../useNavItems';
import { TOP_APP_BAR_DESKTOP_HEIGHT } from './TopAppBar';

export default function NavigationRail() {
  const items = useNavItems();
  const { pathname } = useLocation();

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* Same height as the top bar (+1px for its bottom border), so the divider
          under the logo continues the line under the top bar. */}
      <Box
        sx={{
          height: TOP_APP_BAR_DESKTOP_HEIGHT + 1,
          flexShrink: 0,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="div">Account This!</Typography>
      </Box>

      <List component="nav" sx={{ px: 1 }}>
        {items.map((item) => {
          // Exact match OR nested route: "/journal" highlights on "/journal/123"
          const isActive =
            pathname === item.path || pathname.startsWith(item.path + '/');

          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.path}
                selected={isActive}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}