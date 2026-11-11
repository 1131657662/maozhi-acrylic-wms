import { z } from 'zod';
import { ApiError, diagnosticPath } from './errors';
import { reportRequestError } from './error-events';
import { WEB_REQUEST_TIMEOUT_MS } from '../text';
export { ApiError } from './errors';
const envelope = z.object({ code: z.string(), message: z.string(), data: z.unknown(), traceId: z.string() });

export async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  try {
    return await send(path, schema, init);
  } catch (cause) {
    const error =
      cause instanceof ApiError
        ? cause
        : new ApiError(
            '',
            0,
            '',
            undefined,
            cause instanceof DOMException && ['TimeoutError', 'AbortError'].includes(cause.name)
              ? 'TIMEOUT'
              : 'NETWORK',
            diagnosticPath(path),
          );
    if (init.method && init.method !== 'GET') reportRequestError(error);
    throw error;
  }
}
async function send<T>(path: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS),
  });
  const body = envelope.safeParse(await response.json().catch(() => null));
  const trace = body.success ? body.data.traceId : (response.headers.get('x-request-id') ?? '');
  const route = diagnosticPath(path);
  if (!response.ok)
    throw new ApiError(
      body.success ? body.data.message : '',
      response.status,
      trace,
      body.success ? body.data.data : undefined,
      undefined,
      route,
    );
  if (!body.success) throw new ApiError('', response.status, trace, undefined, 'DATA_INVALID', route);
  const parsed = schema.safeParse(body.data.data);
  if (!parsed.success) throw new ApiError('', response.status, trace, undefined, 'DATA_INVALID', route);
  return parsed.data;
}
