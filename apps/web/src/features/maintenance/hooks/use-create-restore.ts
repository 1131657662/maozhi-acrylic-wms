import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backupAcceptedSchema, type RestoreRequest } from '@wms/contracts';
import { request } from '../../../api/client';
import { maintenanceKeys, maintenanceMutations } from '../queries/maintenance-keys';
import { restoreCopy as t } from '../restore-copy';

export function useCreateRestore() {
  const client = useQueryClient();
  return useMutation({
    ...maintenanceMutations.restore,
    meta: { skipWorkbenchRefresh: true },
    mutationFn: async (body: RestoreRequest) => {
      const storage = t.operationStorage + body.artifactId;
      const key = sessionStorage.getItem(storage) ?? crypto.randomUUID();
      sessionStorage.setItem(storage, key);
      const accepted = await request('/maintenance/restores', backupAcceptedSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(body),
      });
      sessionStorage.removeItem(storage);
      return accepted;
    },
    onSettled: () => client.invalidateQueries({ queryKey: maintenanceKeys._def }),
  });
}
