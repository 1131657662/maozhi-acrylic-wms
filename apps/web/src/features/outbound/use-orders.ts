import { useQuery } from '@tanstack/react-query';
import { outboundKeys, type Filters } from './keys';
export function useOrders(filters: Filters) {
  return useQuery({ ...outboundKeys.list(filters), refetchInterval: 10000 });
}
