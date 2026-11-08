import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { stockAdjustmentSchema, stockAdjustmentResultSchema, type StockAdjustment } from '@wms/contracts';
import { request } from '../../api/client';
import { stockKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useAdjustStock() {
  const client = useQueryClient();
  const pending = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: StockAdjustment) => {
      const body = JSON.stringify(stockAdjustmentSchema.parse(input));
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request('/stock/adjustments', stockAdjustmentResultSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key },
        body,
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: stockKeys._def });
      await client.invalidateQueries({ queryKey: webListKeys._def });
    },
  });
}
