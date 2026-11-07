import { useQuery } from '@tanstack/react-query';
import { outboundKeys } from './keys';
export function useOrder(id: string) {
  return useQuery({ ...outboundKeys.detail(id), enabled: Boolean(id), refetchInterval: 5000 });
}
