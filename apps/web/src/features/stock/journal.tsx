import { useQuery } from '@tanstack/react-query';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { Alert, Button, Result } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { journalSchema, tonnes } from '@wms/contracts';
import { ApiError, request } from '../../api/client';
import { JournalTypeTag } from '../../components/JournalTypeTag';
import { formatTime } from '../../lib/format-time';

const keys = createQueryKeys('stock-journal', {
  recent: { queryKey: null, queryFn: () => request('/stock/journal?limit=20', journalSchema) },
});
export function StockJournal() {
  const query = useQuery(keys.recent);
  if (query.error instanceof ApiError && query.error.status === 403)
    return <Result status="403" title="无权查看库存流水" />;
  if (query.error)
    return (
      <Alert
        type="error"
        title={query.error.message}
        action={<Button onClick={() => void query.refetch()}>重试</Button>}
      />
    );
  return (
    <ProTable
      rowKey="id"
      headerTitle="最近 20 条库存流水"
      dataSource={query.data}
      loading={query.isLoading}
      search={false}
      options={false}
      pagination={false}
      locale={{ emptyText: '暂无库存流水' }}
      columns={[
        { title: '类型', render: (_, row) => <JournalTypeTag type={row.type} /> },
        { title: '仓库', dataIndex: 'warehouseCode' },
        { title: '商品', dataIndex: 'productCode' },
        { title: '包数变化', dataIndex: 'packagesDelta' },
        { title: '重量变化（吨）', render: (_, row) => tonnes(row.weightDeltaGrams) },
        { title: '时间', render: (_, row) => formatTime(row.createdAt) },
      ]}
    />
  );
}
