import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { WEB_REQUEST_TIMEOUT_MS } from '../../text';

export function useScanExport(id: string, number: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/outbound/${id}/scan-records.xlsx`, {
        credentials: 'include',
        signal: AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new ApiError('', response.status, response.headers.get('x-request-id') ?? '');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${number}-扫码清单.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
