import { createQueryKeys } from '@lukemorales/query-key-factory';
import {
  stockMovementPageSchema,
  stockPeekSchema,
  STOCK_PEEK_MAX_PAIRS,
  type StockPair,
  type StockMovementQuery,
} from '@wms/contracts';
import { request } from '../../api/client';

export const movementKeys = createQueryKeys('stock-movements', {
  peek: (pairs: StockPair[], scope: string) => ({
    queryKey: [scope, pairs],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const batches = [];
      for (let index = 0; index < pairs.length; index += STOCK_PEEK_MAX_PAIRS) {
        batches.push(
          request('/stock/peek', stockPeekSchema, {
            method: 'POST',
            body: JSON.stringify(pairs.slice(index, index + STOCK_PEEK_MAX_PAIRS)),
            signal,
          }),
        );
      }
      return (await Promise.all(batches)).flat();
    },
  }),
  page: (params: StockMovementQuery, scope: string) => ({
    queryKey: [scope, params],
    queryFn: () =>
      request(
        `/stock/movements?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`,
        stockMovementPageSchema,
      ),
  }),
});
