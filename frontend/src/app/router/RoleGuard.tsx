// src/app/router/RoleGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from '../providers/AuthProvider';
import type { Role } from './routes';

interface RoleGuardProps {
  /** Omit to allow any signed-in user */
  roles?: Role[];
}

/** Shown while we're probing the refresh cookie on first mount. */
function AuthSplash() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default function RoleGuard({ roles }: RoleGuardProps) {
  const { user, isInitialized } = useAuth();

  // While we're still restoring the session, don't bounce to /login.
  if (!isInitialized) return <AuthSplash />;

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/overview" replace />;
  }

  return <Outlet />;
}