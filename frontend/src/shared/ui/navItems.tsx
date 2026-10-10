import { HomeIcon, BuildIcon, ListAltIcon, GroupIcon, PersonIcon } from '../Icons';

export const navItems = [
  { label: 'Обзор',        path: '/overview', icon: <HomeIcon /> },
  { label: 'Инструменты',  path: '/tools',    icon: <BuildIcon /> },
  { label: 'Журнал',       path: '/journal',  icon: <ListAltIcon /> },
  { label: 'Пользователи', path: '/users',    icon: <GroupIcon /> },
  { label: 'Профиль',      path: '/profile',  icon: <PersonIcon /> },
];