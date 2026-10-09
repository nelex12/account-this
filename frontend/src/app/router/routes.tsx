// src/app/router/routes.tsx
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../providers/AuthProvider'; // to be created: returns { user: { role } | null }
import RoleGuard from './RoleGuard';
import DesktopLayout from './layouts/DesktopLayout';
import MobileLayout from './layouts/MobileLayout';
import SimpleLayout from './layouts/SimpleLayout';

import LoginPage from '../../pages/auth/LoginPage';
import SignUpPage from '../../pages/auth/SignUpPage'; // rename SignUpPage.tsx
import OwnerOverviewPage from '../../pages/overview/OwnerOverviewPage';
import ToolsPage from '../../pages/tools/ToolsPage';
import JournalPage from '../../pages/journal/JournalPage'; // rename JournalPage.tsx
import UsersPage from '../../pages/users/UsersPage';

export type Role = 'Owner' | 'Issuer' | 'Worker';

/**
 * Per-route top bar config. Layouts read it with useMatches():
 *   const topBar = useMatches().at(-1)?.handle?.topBar
 */
export interface RouteHandle {
  topBar?: {
    title: string;
    supportingText?: string;
    statusLabel?: string;
  };
}

/** Picks the shell by role. Each layout renders <Outlet /> inside. */
function LayoutByRole() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'Owner':
      return <DesktopLayout />;
    case 'Issuer':
      return <MobileLayout />;
    case 'Worker':
      return <SimpleLayout />;
  }
}

/** One URL, different content per role. */
function OverviewByRole() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'Owner':
      return <OwnerOverviewPage />;
    case 'Issuer':
      return <div>IssuerOverviewPage (TODO)</div>;
    case 'Worker':
      return <div>WorkerOverviewPage (TODO)</div>;
    default:
      return <Navigate to="/login" replace />;
  }
}

/** Already signed in? Skip the auth pages. */
function PublicOnly() {
  const { user } = useAuth();
  return user ? <Navigate to="/overview" replace /> : <Outlet />;
}

export const router = createBrowserRouter([
  // Public
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <SignUpPage /> },
    ],
  },

  // Private: must be signed in, shell depends on role
  {
    element: <RoleGuard />, // no roles prop = any signed-in user
    children: [
      {
        element: <LayoutByRole />,
        children: [
          {
            path: '/overview',
            element: <OverviewByRole />,
            handle: { topBar: { title: 'Обзор', statusLabel: 'В сети' } } satisfies RouteHandle,
          },
          {
            path: '/profile',
            element: <div>ProfilePage (TODO)</div>,
            handle: { topBar: { title: 'Профиль' } } satisfies RouteHandle,
          },

          // Owner + Issuer
          {
            element: <RoleGuard roles={['Owner', 'Issuer']} />,
            children: [
              {
                path: '/tools',
                element: <ToolsPage />,
                handle: { topBar: { title: 'Инструменты', statusLabel: 'В сети' } } satisfies RouteHandle,
              },
              {
                path: '/logs',
                element: <JournalPage />,
                handle: { topBar: { title: 'Журнал операций', statusLabel: 'В сети' } } satisfies RouteHandle,
              },
            ],
          },

          // Owner only
          {
            element: <RoleGuard roles={['Owner']} />,
            children: [
              {
                path: '/users',
                element: <UsersPage />,
                handle: { topBar: { title: 'Пользователи' } } satisfies RouteHandle,
              },
            ],
          },
        ],
      },
    ],
  },

  { path: '/', element: <Navigate to="/overview" replace /> },
  { path: '*', element: <Navigate to="/overview" replace /> },
]);