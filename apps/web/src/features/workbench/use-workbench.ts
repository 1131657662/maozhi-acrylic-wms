import { useQuery } from '@tanstack/react-query';
import { WORKBENCH } from '@wms/contracts';
import { useSession } from '../auth/use-session';
import { workbenchKeys } from './keys';

export function useWorkbench(poll = false) {
  const { data: session } = useSession();
  return useQuery({
    ...workbenchKeys.dashboard,
    enabled: !!session,
    staleTime: WORKBENCH.ttlMs,
    retry: false,
    retryOnMount: false,
    refetchInterval: poll ? WORKBENCH.ttlMs : false,
    refetchOnWindowFocus: false,
  });
}
