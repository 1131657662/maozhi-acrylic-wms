import { useQuery } from '@tanstack/react-query';
import { MESSAGES } from '@wms/contracts';
import { useSession } from '../auth/use-session';
import { messageKeys } from './keys';

export function useUnread() {
  const { data: session } = useSession();
  return useQuery({
    ...messageKeys.count,
    enabled: !!session,
    refetchInterval: MESSAGES.pollMs,
    staleTime: MESSAGES.pollMs,
    retry: false,
  });
}
