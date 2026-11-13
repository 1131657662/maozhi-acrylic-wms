import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import type { CatalogExportQuery } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { WEB_REQUEST_TIMEOUT_MS } from '../../text';
import { catalogReadCopy } from './export-copy';

const failureSchema = z.object({ message: z.string(), traceId: z.string().optional() });
export function useCatalogExport() {
  return useMutation({ mutationFn: downloadCatalog });
}
async function downloadCatalog(query: CatalogExportQuery): Promise<void> {
  try {
    await fetchDownload(query);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timeout = error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new ApiError('', 0, '', undefined, timeout ? 'TIMEOUT' : 'NETWORK', '/catalog/export');
  }
}
async function fetchDownload(query: CatalogExportQuery): Promise<void> {
  const params = new URLSearchParams({ q: query.q, versionId: String(query.versionId) });
  const response = await fetch(`/api/v1/catalog/export?${params}`, {
    credentials: 'include',
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
  link.download = catalogReadCopy.exportFile;
  link.click();
  URL.revokeObjectURL(url);
}
