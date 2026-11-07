import { useQuery } from '@tanstack/react-query';
import { Alert } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { tonnes } from '@wms/contracts';
import { outboundKeys } from './keys';
export function Stock() {
  const {
    data: stock,
    isLoading: isLoadingStock,
    error: stockError,
  } = useQuery({ ...outboundKeys.stock, refetchInterval: 10000 });
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INVENTORY</span>
          <h1>库存概览</h1>
          <p>包数与总重量独立记录；只读查看确认后的库存。</p>
        </div>
      </div>
      {stockError && <Alert type="error" title={stockError.message} />}
      <ProTable
        rowKey={(row) => `${row.warehouseCode}/${row.productCode}`}
        dataSource={stock}
        loading={isLoadingStock}
        search={false}
        options={false}
        pagination={false}
        columns={[
          { title: '仓库', dataIndex: 'warehouseCode' },
          { title: '商品', dataIndex: 'productCode' },
          { title: '库存包数', dataIndex: 'packages' },
          { title: '库存总重量（吨）', render: (_, row) => tonnes(row.weightGrams) },
        ]}
      />
    </section>
  );
}
