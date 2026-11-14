import { Tooltip, theme } from 'antd';
import { stockBalanceCopy, tonnes, type WebStockRow } from '@wms/contracts';

export function AvailableStock({ quantity }: { quantity: WebStockRow['available'] }) {
  const { token } = theme.useToken();
  const shortage = quantity.packages < 0 || quantity.weightGrams < 0;
  return (
    <Tooltip title={shortage ? stockBalanceCopy.shortage : undefined} trigger={['hover', 'focus']}>
      <span data-testid="stock-available" tabIndex={shortage ? 0 : undefined}>
        <span
          data-testid="stock-available-packages"
          style={{ color: quantity.packages < 0 ? token.colorError : undefined, whiteSpace: 'nowrap' }}
        >
          {quantity.packages} {stockBalanceCopy.packages}
        </span>
        <br />
        <span
          data-testid="stock-available-tonnes"
          style={{ color: quantity.weightGrams < 0 ? token.colorError : undefined, whiteSpace: 'nowrap' }}
        >
          {tonnes(quantity.weightGrams)} {stockBalanceCopy.tonnes}
        </span>
      </span>
    </Tooltip>
  );
}
