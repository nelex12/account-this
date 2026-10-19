// AddToolDialogProvider.tsx
// Holds the open/closed state of the "add tool" dialog so it can be opened from
// the top bar button (rendered by the layouts) and from the page itself.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import AddToolDialog from '../../shared/ui/AddToolDialog';

interface AddToolDialogContextValue {
  openAddTool: () => void;
}

const AddToolDialogContext = createContext<AddToolDialogContextValue | null>(null);

export function AddToolDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAddTool = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openAddTool }), [openAddTool]);

  return (
    <AddToolDialogContext.Provider value={value}>
      {children}
      <AddToolDialog open={open} onClose={() => setOpen(false)} />
    </AddToolDialogContext.Provider>
  );
}

export function useAddToolDialog(): AddToolDialogContextValue {
  const ctx = useContext(AddToolDialogContext);
  if (!ctx) {
    throw new Error('useAddToolDialog must be used inside <AddToolDialogProvider>');
  }
  return ctx;
}