import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, stocktakeCopy, type PublicStocktakeLine } from '@wms/contracts';
import { stocktakeKeys } from './keys';
import { StocktakeQueryState } from './query-state';
import { ReadingDrawer } from './reading-drawer';

function columns(hidden: boolean): ProColumns<PublicStocktakeLine>[] {
  return [
    {
      key: 'product',
      title: '库存商品',
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
    ...(!hidden
      ? [
          {
            key: 'snapshot',
            title: businessCopy.stocktakeLines1,
            width: 160,
            render: (_: unknown, r: PublicStocktakeLine) =>
              r.visibility === 'visible' ? `${r.snapshot.packages} / ${tonnes(r.snapshot.weightGrams)}` : null,
          },
        ]
      : []),
    {
      key: 'actual',
      title: '实盘（包 / 吨）',
      width: 160,
      render: (_, r) => (r.actual ? `${r.actual.packages} / ${tonnes(r.actual.weightGrams)}` : '未录'),
    },
    ...(!hidden
      ? [
          {
            key: 'delta',
            title: '差异（包 / 吨）',
            width: 160,
            render: (_: unknown, r: PublicStocktakeLine) =>
              r.visibility === 'hidden' || r.weightDeltaGrams === null ? (
                '未录'
              ) : (
                <span>
                  {r.packagesDelta} / <span>{tonnes(r.weightDeltaGrams)}</span>
                </span>
              ),
          },
        ]
      : []),
  ];
}
export function StocktakeLines({ id, editable, hidden }: { id: string; editable: boolean; hidden: boolean }) {
  const [params, setParams] = useState({ page: '1', pageSize: '20' }),
    [editing, setEditing] = useState<PublicStocktakeLine | null>(null);
  const query = useQuery(stocktakeKeys.lines(id, params));
  return (
    <StocktakeQueryState query={query}>
      <ProTable<PublicStocktakeLine>
        rowKey="productCode"
        headerTitle={hidden ? stocktakeCopy.hiddenLines : businessCopy.stocktakeLines2}
        search={false}
        options={false}
        scroll={{ x: 788 }}
        dataSource={query.data?.items ?? []}
        loading={query.isFetching}
        columns={[
          ...columns(hidden),
          {
            key: 'actions',
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
