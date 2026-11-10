import { useQuery } from '@tanstack/react-query';
import { stockKeys } from './keys';

export function useSourceStock() {
  return useQuery({ ...stockKeys.view('inventory'), refetchInterval: 10000 });
}
