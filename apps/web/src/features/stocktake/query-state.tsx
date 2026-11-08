import { Alert, Button, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { ApiError } from '../../api/client';

export function StocktakeQueryState({
  query,
  children,
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown };
  children: ReactNode;
}) {
  if (query.error instanceof ApiError && query.error.status === 403)
    return <Result status="403" title="此客户端无权盘点" />;
  if (query.error)
    return (
      <Alert
        type="error"
        showIcon
        title="盘点数据加载失败"
        description={query.error.message}
        action={<Button onClick={() => query.refetch()}>重试</Button>}
      />
    );
  if (query.isPending) return <Skeleton active />;
  return <>{children}</>;
}
