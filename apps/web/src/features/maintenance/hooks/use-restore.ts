import { useQuery } from '@tanstack/react-query';
import { MAINTENANCE } from '@wms/contracts';
import { maintenanceKeys } from '../queries/maintenance-keys';
import { activeJob } from './use-jobs';

export function useRestore(id: string) {
  return useQuery({
    ...maintenanceKeys.restore(id),
    retry: false,
    refetchInterval: (query) => (query.state.data && activeJob(query.state.data.job) ? MAINTENANCE.pollMs : false),
  });
}
