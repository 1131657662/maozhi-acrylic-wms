import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backupAcceptedSchema } from '@wms/contracts';
import { request } from '../../../api/client';
import { maintenanceKeys, maintenanceMutations } from '../queries/maintenance-keys';
import { MAINTENANCE_UI } from '../copy';

export function useCreateBackup() {
  const client = useQueryClient();
  return useMutation({
    ...maintenanceMutations.backup,
    meta: { skipWorkbenchRefresh: true },
    mutationFn: async () => {
      const key = sessionStorage.getItem(MAINTENANCE_UI.operationStorage) ?? crypto.randomUUID();
      sessionStorage.setItem(MAINTENANCE_UI.operationStorage, key);
      const accepted = await request('/maintenance/backups', backupAcceptedSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: '{}',
      });
      sessionStorage.removeItem(MAINTENANCE_UI.operationStorage);
      return accepted;
    },
    onSettled: () => client.invalidateQueries({ queryKey: maintenanceKeys._def }),
  });
}
