import { createQueryKeys } from '@lukemorales/query-key-factory';
import { messageListSchema, unreadCountSchema, type MessageType } from '@wms/contracts';
import { request } from '../../api/client';

export interface MessageFilters {
  type?: MessageType;
  unread?: boolean;
  page: number;
}
export const messageKeys = createQueryKeys('messages', {
  count: { queryKey: null, queryFn: () => request('/messages/unread-count', unreadCountSchema) },
  list: (filters: MessageFilters) => ({
    queryKey: [filters],
    queryFn: () => {
      const query = new URLSearchParams({ page: String(filters.page) });
      if (filters.type) query.set('type', filters.type);
      if (filters.unread !== undefined) query.set('unread', String(filters.unread));
      return request(`/messages?${query}`, messageListSchema);
    },
  }),
});
