import { useQuery } from '@tanstack/react-query';
import { authKeys } from './keys';
export function useSession() {
  return useQuery({ ...authKeys.session, retry: false, staleTime: 30000 });
}
