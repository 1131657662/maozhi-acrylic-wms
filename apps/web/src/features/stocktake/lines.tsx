import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, type StocktakeLine } from '@wms/contracts';
import { stocktakeKeys } from './keys';
import { StocktakeQueryState } from './query-state';
import { ReadingDrawer } from './reading-drawer';

const columns: ProColumns<StocktakeLine>[] = [
  {
    title: 'ERP 商品',
    dataIndex: 'productName',
    width: 220,
    fixed: 'left',
    render: (_, r) => (
      <span>
        {r.productName}
        <br />
        {r.productCode}
      </span>
    ),
  },
  {
    title: '快照（包 / 吨）',
    width: 160,
    render: (_, r) => `${r.snapshot.packages} / ${tonnes(r.snapshot.weightGrams)}`,
  },
  {
    title: '实盘（包 / 吨）',
    width: 160,
    render: (_, r) => (r.actual ? `${r.actual.packages} / ${tonnes(r.actual.weightGrams)}` : '未录'),
  },
  {
    title: '差异（包 / 吨）',
    width: 160,
    render: (_, r) =>
      r.weightDeltaGrams === null ? (
        '未录'
      ) : (
        <span>
          {r.packagesDelta} / <span>{tonnes(r.weightDeltaGrams)}</span>
        </span>
      ),
  },
];
export function StocktakeLines({ id, editable }: { id: string; editable: boolean }) {
  const [params, setParams] = useState({ page: '1', pageSize: '20' }),
    [editing, setEditing] = useState<StocktakeLine | null>(null);
  const query = useQuery(stocktakeKeys.lines(id, params));
  return (
    <StocktakeQueryState query={query}>
      <ProTable<StocktakeLine>
        rowKey="productCode"
        headerTitle="实盘明细 · 差异 = 实盘 − 固定快照"
        search={false}
        options={false}
        scroll={{ x: 788 }}
        dataSource={query.data?.items ?? []}
        loading={query.isFetching}
        columns={[
          ...columns,
          {
            title: '操作',
            width: 88,
            fixed: 'right',
            render: (_, r) =>
              editable ? (
                <Button type="link" onClick={() => setEditing(r)}>
                  录入
                </Button>
              ) : (
                '已终结'
              ),
          },
        ]}
        pagination={{
          current: Number(params.page),
          pageSize: Number(params.pageSize),
          total: query.data?.total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200],
          onChange: (p, s) => setParams({ page: String(p), pageSize: String(s) }),
        }}
      />
      {editing && <ReadingDrawer id={id} line={editing} onClose={() => setEditing(null)} />}
    </StocktakeQueryState>
  );
}
