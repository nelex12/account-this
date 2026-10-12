// src/app/navigation/navItems.tsx
import type { ReactNode } from 'react';
import type { Role } from '../app/router/routes';
import {
  HomeIcon,
  BuildIcon,
  ListAltIcon,
  GroupIcon,
  PersonIcon,
} from './Icons';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  /** Roles that can see + reach this destination. Omit for "everyone". */
  roles?: Role[];
  /** Hide from the bottom nav (mobile) — e.g. Owner-only admin pages. */
  hideInBottomNav?: boolean;
}

export const navItems: NavItem[] = [
  { label: 'Обзор',        path: '/overview', icon: <HomeIcon /> },
  { label: 'Инструменты',  path: '/tools',    icon: <BuildIcon />, roles: ['Owner', 'Issuer'] },
  { label: 'Журнал',       path: '/journal',  icon: <ListAltIcon />, roles: ['Owner', 'Issuer'] },
  { label: 'Пользователи', path: '/users',    icon: <GroupIcon />, roles: ['Owner'] },
  { label: 'Профиль',      path: '/profile',  icon: <PersonIcon /> },
];