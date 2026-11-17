import { createQueryKeys, createMutationKeys } from '@lukemorales/query-key-factory';
import { maintenanceJobsSchema, backupArtifactsSchema, maintenanceHealthSchema, MAINTENANCE } from '@wms/contracts';
import { request } from '../../../api/client';

export const maintenanceKeys = createQueryKeys('maintenance', {
  jobs: {
    queryKey: null,
    queryFn: ({ signal }) =>
      request(`/maintenance/jobs?kind=backup&limit=${MAINTENANCE.listLimit}`, maintenanceJobsSchema, { signal }),
  },
  artifacts: (page: number, version: string) => ({
    queryKey: [page, version],
    queryFn: ({ signal }) =>
      request(`/maintenance/artifacts?page=${page}&limit=${MAINTENANCE.listLimit}`, backupArtifactsSchema, { signal }),
  }),
  health: {
    queryKey: null,
    queryFn: ({ signal }) => request('/maintenance/health', maintenanceHealthSchema, { signal }),
  },
});
export const maintenanceMutations = createMutationKeys('maintenance', {
  backup: null,
  retention: null,
  download: null,
});
