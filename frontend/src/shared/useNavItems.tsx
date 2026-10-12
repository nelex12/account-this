// src/app/navigation/useNavItems.ts
import { useMemo } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import { navItems, type NavItem } from './navItems';

export function useNavItems(opts?: { forBottomNav?: boolean }): NavItem[] {
  const { user } = useAuth();
  return useMemo(() => {
    return navItems.filter((item) => {
      if (item.roles && (!user || !item.roles.includes(user.role))) return false;
      if (opts?.forBottomNav && item.hideInBottomNav) return false;
      return true;
    });
  }, [user, opts?.forBottomNav]);
}