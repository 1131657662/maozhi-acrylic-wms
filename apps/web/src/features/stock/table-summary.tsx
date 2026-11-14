import { stockBalanceCopy, tonnes, type WebStockRow } from '@wms/contracts';
import { stockPageTotals } from './page-totals';
import { stockPageCopy } from './stock-copy';

const display = (value: number | null, weight = false) =>
  value === null ? stockPageCopy.missing : weight ? tonnes(value) : value;

function quantity(total: { packages: number | null; weightGrams: number | null }) {
  if (total.packages === null && total.weightGrams === null) return stockPageCopy.missing;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {display(total.packages)} {stockBalanceCopy.packages}
      <br />
      {display(total.weightGrams, true)} {stockBalanceCopy.tonnes}
    </span>
  );
}

export function stockTableSummary(rows: readonly WebStockRow[]) {
  const total = stockPageTotals(rows);
  return {
    productName: stockPageCopy.pageTotal,
    packages: display(total.packages),
    weightGrams: display(total.weightGrams, true),
    pending: quantity(total.pending),
    available: quantity(total.available),
  };
}
