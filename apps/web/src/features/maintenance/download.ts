import { z } from 'zod';
import { ApiError, parseResponse } from '../../api/client';
import { WEB_REQUEST_TIMEOUT_MS } from '../../text';
import { maintenanceCopy as t } from './copy';

export async function downloadBackup(id: string): Promise<void> {
  const route = `/maintenance/artifacts/${z.uuid().parse(id)}/download`;
  try {
    const response = await fetch(`/api/v1${route}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS),
    });
    if (response.status === 409 || response.status === 404) throw new Error(t.downloadRejected);
    if (!response.ok) await parseResponse(route, z.never(), response);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = t.downloadFile;
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    if (error instanceof ApiError || (error instanceof Error && error.message === t.downloadRejected)) throw error;
    const timeout = error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new ApiError('', 0, '', undefined, timeout ? 'TIMEOUT' : 'NETWORK');
  }
}
