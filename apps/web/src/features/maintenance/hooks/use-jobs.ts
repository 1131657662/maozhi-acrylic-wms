import { useQuery } from '@tanstack/react-query';
import { MAINTENANCE, type MaintenanceJob } from '@wms/contracts';
import { maintenanceKeys } from '../queries/maintenance-keys';

export const activeJob = (job: MaintenanceJob) => job.status === 'queued' || job.status === 'running';
export function useJobs() {
  return useQuery({
    ...maintenanceKeys.jobs,
    retry: false,
    refetchInterval: (query) => (query.state.data?.items.some(activeJob) ? MAINTENANCE.pollMs : false),
  });
}
