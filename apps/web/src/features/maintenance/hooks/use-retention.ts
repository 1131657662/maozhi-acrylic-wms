import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retentionResultSchema } from '@wms/contracts';
import { request } from '../../../api/client';
import { maintenanceKeys, maintenanceMutations } from '../queries/maintenance-keys';

export function useRetention() {
  const client = useQueryClient();
  return useMutation({
    ...maintenanceMutations.retention,
    meta: { skipWorkbenchRefresh: true },
    mutationFn: () => request('/maintenance/retention', retentionResultSchema, { method: 'POST', body: '{}' }),
    onSettled: () => client.invalidateQueries({ queryKey: maintenanceKeys._def }),
  });
}
