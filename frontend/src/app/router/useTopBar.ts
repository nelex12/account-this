// useTopBar.ts
// Turns the static route handle (routes.tsx) into props for <TopAppBar>,
// attaching handlers to actions that have an `id` (handles can't use hooks).
import { useMatches } from 'react-router-dom';

import { useAddToolDialog } from '../providers/AddToolDialogProvider';
import type { RouteHandle } from './routes';

export function useTopBar(): RouteHandle['topBar'] {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;
  const { openAddTool } = useAddToolDialog();

  const topBar = handle?.topBar;
  if (!topBar) return undefined;

  const { primaryAction } = topBar;
  if (primaryAction?.id === 'addTool') {
    return { ...topBar, primaryAction: { ...primaryAction, onClick: openAddTool } };
  }
  return topBar;
}