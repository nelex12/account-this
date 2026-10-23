// src/api/heldTools.ts — "tools on hand" for the Worker.
//
// The server has no endpoint for a Worker's tools (GET /api/tools and /api/logs are Issuer/Owner only),
// and it only learns about an operation after the Issuer syncs it. So the list comes from the
// operations THIS device signed and the Worker confirmed ("Завхоз принял").
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../app/providers/AuthProvider';
import { toolsOnHand } from '../offline/operations';
import { queryKeys } from './queryKeys';

export const heldToolsKey = (userId: string | undefined) => [...queryKeys.overview, 'worker-held', userId] as const;

export function useHeldTools() {
  const { user } = useAuth();
  return useQuery({
    queryKey: heldToolsKey(user?.id),
    queryFn: () => toolsOnHand(user!.id),
    enabled: Boolean(user),
    // IndexedDB does not need the network: the default 'online' mode would pause this query offline
    networkMode: 'always',
    staleTime: 0,
  });
}
