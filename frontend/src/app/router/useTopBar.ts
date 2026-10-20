// useTopBar.ts
// Turns the static route handle (routes.tsx) into props for <TopAppBar>,
// attaching handlers to actions that have an `id` (handles can't use hooks).
import { useMatches } from 'react-router-dom';

import { useAddToolDialog } from '../providers/AddToolDialogProvider';
import { useStickersDialog } from '../providers/StickersDialogProvider';
import type { RouteHandle } from './routes';

export function useTopBar(): RouteHandle['topBar'] {
  const handle = useMatches().at(-1)?.handle as RouteHandle | undefined;
  const { openAddTool } = useAddToolDialog();
  const { openStickers } = useStickersDialog();

  const topBar = handle?.topBar;
  if (!topBar) return undefined;

  const { primaryAction, secondaryAction } = topBar;
  return {
    ...topBar,
    ...(primaryAction?.id === 'addTool' && {
      primaryAction: { ...primaryAction, onClick: openAddTool },
    }),
    ...(secondaryAction?.id === 'stickers' && {
      secondaryAction: { ...secondaryAction, onClick: () => openStickers() },
    }),
  };
}