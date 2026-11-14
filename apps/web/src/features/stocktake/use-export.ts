import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { stocktakeCopy } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { WEB_REQUEST_TIMEOUT_MS } from '../../text';

const failureSchema = z.object({ message: z.string(), traceId: z.string().optional() });
interface ExportInput {
  id: string;
  number: string;
  kind: 'blank' | 'result';
}
export function useStocktakeExport() {
  return useMutation({ mutationFn: download });
}
async function download(input: ExportInput): Promise<void> {
  try {
    await fetchDownload(input);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timeout = error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new ApiError('', 0, '', undefined, timeout ? 'TIMEOUT' : 'NETWORK', '/stocktakes/export');
  }
}
async function fetchDownload(input: ExportInput): Promise<void> {
  const response = await fetch(`/api/v1/stocktakes/${input.id}/export?kind=${input.kind}`, {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const failure = failureSchema.safeParse(await response.json().catch(() => null));
    throw new ApiError(
      failure.success ? failure.data.message : '',
      response.status,
      failure.success ? (failure.data.traceId ?? '') : '',
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${input.number}-${input.kind === 'blank' ? stocktakeCopy.exportBlank : stocktakeCopy.exportResult}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
