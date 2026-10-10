import { useLocation, useNavigate } from 'react-router-dom';

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
import { navItems } from './navItems';

export default function NavigationRail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box sx={{ width: 240, flexShrink: 0, alignSelf: 'stretch', display: 'flex',
               flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="div">Account This!</Typography>
      </Box>
      <Divider />

      <List component="nav" sx={{ px: 1 }}>
        {navItems.map(({ label, path, icon }) => (
          <ListItem key={path} disablePadding>
            <ListItemButton selected={pathname.startsWith(path)} onClick={() => navigate(path)}>
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}