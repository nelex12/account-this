// src/app/router/RoleGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import type { Role } from './routes';

interface RoleGuardProps {
  /** Omit to allow any signed-in user */
  roles?: Role[];
}

export default function RoleGuard({ roles }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/overview" replace />;

  return <Outlet />;
}