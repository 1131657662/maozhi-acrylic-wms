import { useMutation } from '@tanstack/react-query';
import { exportJobSchema, type ExportRequest } from '@wms/contracts';
import { request } from '../../api/client';
export function useStartExport() {
  return useMutation({
    mutationFn: (input: ExportRequest) =>
      request('/web/exports', exportJobSchema, { method: 'POST', body: JSON.stringify(input) }),
  });
}
