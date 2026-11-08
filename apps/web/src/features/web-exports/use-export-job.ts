import { useQuery } from '@tanstack/react-query';
import { exportKeys } from './keys';
export function useExportJob(id: string) {
  return useQuery({
    ...exportKeys.job(id),
    enabled: !!id,
    retry: false,
    refetchInterval: (q) => (q.state.data?.state === 'running' ? 500 : false),
  });
}
