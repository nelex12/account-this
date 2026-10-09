// SimpleLayout.tsx
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';

export default function SimpleLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
}