import { useState, type MouseEvent } from 'react';
import { history } from '@umijs/max';
import { messageCopy as t, type SystemMessage } from '@wms/contracts';
import { useMessages } from './use-messages';
import { useReadMessage } from './use-read-message';
import { useUnread } from './use-unread';
import type { MessageFilters } from './keys';

export function useMessagePage() {
  const [filters, setFilters] = useState<MessageFilters>({ page: 1 });
  const query = useMessages(filters);
  const { data: count, error: countError } = useUnread();
  const { mutateAsync: read, isPending: reading, error: readError } = useReadMessage();
  const open = (row: SystemMessage, event: MouseEvent<HTMLAnchorElement>) => {
    const native = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    if (!native) event.preventDefault();
    if (reading) return;
    void read(row.id)
      .then(() => {
        if (!native) history.push(row.linkPath);
      })
      .catch(() => {});
  };
  return {
    filters,
    setFilters,
    query,
    reading,
    readError,
    open,
    description: countError ? t.unknown : count ? t.unreadCount(count.unreadCount) : '…',
    disableAll: !count?.unreadCount || !!countError,
    readAll: () => {
      void read(undefined).catch(() => {});
    },
    changePage: (page: number) => setFilters({ ...filters, page }),
  };
}
