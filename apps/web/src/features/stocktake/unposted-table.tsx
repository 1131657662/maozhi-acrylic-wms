import { businessCopy } from '../../business-copy';
import { ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { tonnes, type StocktakePreview } from '@wms/contracts';

export function UnpostedTable({ rows }: { rows: StocktakePreview['unposted'] }) {
  return (
    <ProTable<StocktakePreview['unposted'][number]>
      headerTitle={`盘点开始后未入账收发货 · ${rows.length} 张`}
      rowKey={(r) => `${r.kind}/${r.id}`}
      dataSource={rows}
      search={false}
      options={false}
      scroll={{ x: 800 }}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      locale={{ emptyText: businessCopy.stocktakeUnpostedTable1 }}
      columns={[
        {
          title: '单号',
          width: 240,
          fixed: 'left',
          render: (_, r) => <Link to={`/${r.kind}/${r.id}`}>{r.number}</Link>,
        },
        {
          title: businessCopy.stocktakeUnpostedTable2,
          width: 120,
          render: (_, r) => (r.kind === 'inbound' ? '入库登记量' : '出库计划量'),
        },
        { title: '包数', dataIndex: 'packages', width: 80 },
        { title: '吨数', width: 110, render: (_, r) => tonnes(r.weightGrams) },
        {
          title: '已扫（包 / 吨）',
          width: 160,
          render: (_, r) =>
            r.scannedPackages === null ? '不扫码' : `${r.scannedPackages} / ${tonnes(r.scannedWeightGrams ?? 0)}`,
        },
      ]}
    />
  );
}
