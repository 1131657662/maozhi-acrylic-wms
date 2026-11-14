import { stockMovementQuerySchema } from '@wms/contracts';

export function parseMovementParams(search: URLSearchParams) {
  return stockMovementQuerySchema.safeParse(Object.fromEntries(search.entries()));
}
export function movementUrl(params: Record<string, string | number>): URLSearchParams {
  return new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
}
