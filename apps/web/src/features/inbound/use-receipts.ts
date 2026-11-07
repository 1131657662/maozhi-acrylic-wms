import { useQuery } from '@tanstack/react-query';
import type { InboundFilters } from './keys';
import { inboundKeys } from './keys';

export function useReceipts(filters: InboundFilters) {
  return useQuery({ ...inboundKeys.list(filters) });
}
