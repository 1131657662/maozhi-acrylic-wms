import { Alert, Button, Empty, Skeleton } from 'antd';
import type { ComponentProps } from 'react';
import { messageCopy as t } from '@wms/contracts';
import { MessageTable } from './table';
import type { useMessages } from './use-messages';

type Props = Pick<ComponentProps<typeof MessageTable>, 'page' | 'busy' | 'onPage' | 'onOpen'> & {
  query: ReturnType<typeof useMessages>;
};
export function MessageResults({ query, ...props }: Props) {
  if (query.error)
    return (
      <Alert
        type="error"
        showIcon
        title={t.error}
        action={<Button onClick={() => void query.refetch()}>{t.retry}</Button>}
      />
    );
  if (query.isPending)
    return (
      <div data-testid="messages-loading">
        <Skeleton active />
      </div>
    );
  if (!query.data?.total) return <Empty description={t.empty} />;
  return <MessageTable {...props} items={query.data.items} total={query.data.total} loading={query.isFetching} />;
}
