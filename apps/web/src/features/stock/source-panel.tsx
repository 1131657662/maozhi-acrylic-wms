import { Alert, Button, Result, Skeleton } from 'antd';
import { ZodError } from 'zod';
import { ApiError } from '../../api/client';
import { useSourceStock } from './use-source-stock';
import { SourceStockTable } from './source-table';
import { StockJournal } from './journal';

export function SourcePanel() {
  const { data: stock, isLoading: isLoadingStock, error: stockError, refetch: reloadStock } = useSourceStock();
  if (stockError instanceof ApiError && stockError.status === 403)
    return <Result status="403" title="无权查看 ERP 库存" />;
  if (stockError)
    return (
      <Alert
        type="error"
        showIcon
        title="ERP 库存加载失败，已停止展示旧数据"
        description={
          stockError instanceof ZodError ? '返回数据未通过来源校验，请重试；未展示任何小计。' : stockError.message
        }
        action={<Button onClick={() => void reloadStock()}>重试</Button>}
      />
    );
  if (isLoadingStock || !stock) return <Skeleton active />;
  return (
    <>
      <SourceStockTable data={stock} />
      <StockJournal />
    </>
  );
}
