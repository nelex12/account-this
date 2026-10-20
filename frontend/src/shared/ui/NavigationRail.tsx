// src/app/router/layouts/NavigationRail.tsx
import {
  Box, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import { useNavItems } from '../useNavItems';

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
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="div">Account This!</Typography>
      </Box>

      <Divider />

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