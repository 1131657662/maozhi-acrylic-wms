import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, businessLabels, type Detail } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
type Fact = Detail['facts'][number];
const columns: ProColumns<Fact>[] = [
  { title: '条码', dataIndex: 'barcode' },
  { title: '实际重量（吨）', render: (_, row) => tonnes(row.weightGrams) },
  { title: '取重目录版本', dataIndex: 'catalogVersion', render: (_, row) => `第 ${row.catalogVersion} 版` },
  {
    title: '来源',
    dataIndex: 'weightSource',
    render: (_, row) => (row.weightSource === 'catalog' ? businessLabels.catalogSource : businessLabels.unknown),
  },
  { title: '记录人', dataIndex: 'recordedBy' },
  { title: '扫码时间', dataIndex: 'scannedAt', render: (_, row) => formatTime(row.scannedAt) },
];
export function Facts({ order }: { order: Detail }) {
  return (
    <ProTable<Fact>
      headerTitle="扫码事实"
      rowKey="id"
      columns={columns}
      dataSource={order.facts}
      search={false}
      options={false}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 850 }}
    />
  );
}
