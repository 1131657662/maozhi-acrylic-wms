import { useQuery } from '@tanstack/react-query';
import { inboundKeys } from './keys';

export function useReceipt(id: string) {
  return useQuery({ ...inboundKeys.detail(id), enabled: Boolean(id) });
}
