import { WORKBENCH, workbenchSchema } from '@wms/contracts';
import { ApiError, parseResponse, request } from '../../api/client';
import type {} from './initial-request';

export async function loadWorkbench() {
  const initial = window.__wmsWorkbenchRequest;
  delete window.__wmsWorkbenchRequest;
  if (!initial || Date.now() - initial.started >= WORKBENCH.ttlMs) return request('/web/dashboard', workbenchSchema);
  const result = await initial.result;
  if ('error' in result)
    throw new ApiError('', 0, '', undefined, result.error === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK', '/web/dashboard');
  return parseResponse('/web/dashboard', workbenchSchema, result.response);
}
