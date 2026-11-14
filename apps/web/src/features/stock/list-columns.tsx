import type { ProColumns } from '@ant-design/pro-components';
import { stockBalanceCopy, tonnes, type WebStockRow } from '@wms/contracts';
import { Button } from 'antd';
import { AvailableStock } from './available-stock';

const BALANCE_COLUMN_WIDTH = 180;

export function stockListColumns(onAdjust: (row: WebStockRow) => void): ProColumns<WebStockRow>[] {
  return [
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 240,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      hideInSetting: true,
    },
    {
      title: '库存包数',
      dataIndex: 'packages',
      width: 120,
      align: 'right',
      sorter: true,
      render: (_, row) => <span data-testid="stock-row-packages">{row.packages}</span>,
    },
    {
      title: '库存重量（吨）',
      dataIndex: 'weightGrams',
      width: 160,
      align: 'right',
      sorter: true,
      render: (_, row) => <span data-testid="stock-row-tonnes">{tonnes(row.weightGrams)}</span>,
    },
    {
      title: stockBalanceCopy.pending,
      dataIndex: 'pending',
      width: BALANCE_COLUMN_WIDTH,
      align: 'right',
      render: (_, row) => (
        <span data-testid="stock-pending" style={{ whiteSpace: 'nowrap' }}>
          {row.pending.packages} {stockBalanceCopy.packages}
          <br />
          {tonnes(row.pending.weightGrams)} {stockBalanceCopy.tonnes}
        </span>
      ),
    },
    {
      title: stockBalanceCopy.available,
      dataIndex: 'available',
      width: BALANCE_COLUMN_WIDTH,
      align: 'right',
      render: (_, row) => <AvailableStock quantity={row.available} />,
    },
    { title: '商品编码', dataIndex: 'productCode', width: 180, sorter: true },
    {
      title: '仓库',
      dataIndex: 'warehouseCode',
      width: 180,
      sorter: true,
      render: (_, row) => row.warehouseName + '（' + row.warehouseCode + '）',
    },
    {
      title: '操作',
      key: 'action',
      valueType: 'option',
      width: 110,
      fixed: 'right',
      hideInSetting: true,
      render: (_, row) => (
        <Button type="link" onClick={() => onAdjust(row)}>
          调整库存
        </Button>
      ),
    },
  ];
}
