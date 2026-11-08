import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { numberingRulesSchema, numberingRuleSchema, type DocumentKind, type NumberingUpdate } from '@wms/contracts';
import { request } from '../../api/client';

export const numberingKeys = createQueryKeys('document-numbering', {
  rules: { queryKey: null, queryFn: () => request('/document-numbering', numberingRulesSchema) },
});
export function useSaveNumbering(kind: DocumentKind) {
  const client = useQueryClient();
  const pending = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: NumberingUpdate) => {
      const body = JSON.stringify(input);
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request(`/document-numbering/${kind}`, numberingRuleSchema, {
        method: 'PUT',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () => {
      pending.current = null;
      return client.invalidateQueries({ queryKey: numberingKeys._def });
    },
  });
}
