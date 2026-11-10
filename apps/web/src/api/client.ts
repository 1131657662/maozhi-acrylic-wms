import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public traceId: string,
    public data?: unknown,
  ) {
    super(message);
  }
}
const envelope = z.object({ code: z.string(), message: z.string(), data: z.unknown(), traceId: z.string() });

export async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  const body = envelope.parse(await response.json());
  if (!response.ok) throw new ApiError(body.message, response.status, body.traceId, body.data);
  return schema.parse(body.data);
}
