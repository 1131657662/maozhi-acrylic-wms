import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { masterItemSchema, type MasterCatalog, type CreateMasterItem } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface CreateMasterItemInput extends CreateMasterItem {
  catalog: MasterCatalog;
  name: string;
}

export function useCreateMasterItem() {
  const client = useQueryClient();
  const pending = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    mutationFn: ({ catalog, ...body }: CreateMasterItemInput) => {
      const payload = JSON.stringify({ catalog, ...body });
      if (pending.current?.payload !== payload) pending.current = { payload, key: crypto.randomUUID() };
      return request(`/master/${catalog}`, masterItemSchema, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () => {
      pending.current = null;
      return client.invalidateQueries({ queryKey: masterDataKeys._def });
    },
  });
}
