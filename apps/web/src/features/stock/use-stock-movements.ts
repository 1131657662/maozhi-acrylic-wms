import { useQuery } from '@tanstack/react-query';
import { STOCK_MOVEMENT_PAGE_SIZE, type StockMovementQuery } from '@wms/contracts';
import { movementKeys } from './movement-keys';

export function useStockMovements(params: StockMovementQuery | undefined, scope = 'journal-page') {
  return useQuery({
    ...movementKeys.page(params ?? { page: 1, pageSize: STOCK_MOVEMENT_PAGE_SIZE }, scope),
    enabled: params !== undefined,
    staleTime: 0,
    retry: false,
  });
}
