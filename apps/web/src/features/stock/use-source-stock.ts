import { useQuery } from '@tanstack/react-query';
import type { StockSource } from '@wms/contracts';
import { stockKeys } from './keys';

export function useSourceStock(source: StockSource) {
  return useQuery({ ...stockKeys.view(source), refetchInterval: 10000 });
}
