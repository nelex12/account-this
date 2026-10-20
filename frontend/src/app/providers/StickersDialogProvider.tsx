// StickersDialogProvider.tsx
// Open/closed state of the "print / download stickers" dialog, so it can be opened from
// the top bar button (rendered by the layouts) and from pages (same idea as AddToolDialogProvider).
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import StickersDialog from '../../pages/tools/stickers/StickersDialog';

interface StickersDialogContextValue {
  /** Opens the dialog; `toolIds` are pre-selected (default: nothing selected). */
  openStickers: (toolIds?: string[]) => void;
}

const StickersDialogContext = createContext<StickersDialogContextValue | null>(null);

export function StickersDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preselected, setPreselected] = useState<string[]>([]);

  const openStickers = useCallback((toolIds: string[] = []) => {
    setPreselected(toolIds);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openStickers }), [openStickers]);

  return (
    <StickersDialogContext.Provider value={value}>
      {children}
      <StickersDialog open={open} preselectedIds={preselected} onClose={() => setOpen(false)} />
    </StickersDialogContext.Provider>
  );
}

export function useStickersDialog(): StickersDialogContextValue {
  const ctx = useContext(StickersDialogContext);
  if (!ctx) throw new Error('useStickersDialog must be used inside <StickersDialogProvider>');
  return ctx;
}
