import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unreadCountSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { messageKeys } from './keys';

export function useReadMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string | undefined) =>
      request(id ? `/messages/${id}/read` : '/messages/read-all', unreadCountSchema, { method: 'POST', body: '{}' }),
    meta: { skipWorkbenchRefresh: true },
    onMutate: () => client.cancelQueries({ queryKey: messageKeys._def }),
    onSuccess: (count) => {
      client.setQueryData(messageKeys.count.queryKey, count);
      return client.invalidateQueries({ queryKey: messageKeys.list._def });
    },
  });
}
