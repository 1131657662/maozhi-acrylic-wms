import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exportJobSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { exportKeys } from './keys';
export function useCancelExport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/web/exports/${id}/cancel`, exportJobSchema, { method: 'POST' }),
    onSuccess: (job) => client.setQueryData(exportKeys.job(job.id).queryKey, job),
  });
}
