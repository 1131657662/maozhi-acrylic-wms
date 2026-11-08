import type { ReportBalance } from './reports.ts';

export function reconciliationLines(balance: ReportBalance) {
  const fields = [
    ['opening', '期初'],
    ['inbound', '+ 入库（含撤销）'],
    ['outbound', '− 出库（含撤销）'],
    ['adjustment', '± 其他库存变化'],
    ['closing', '= 期末'],
    ['difference', '对账差额（期末 − 计算期末）'],
  ] as const;
  return fields.map(([key, label]) => ({
    label,
    packages: balance[`${key}Packages`],
    weightGrams: balance[`${key}Grams`],
  }));
}
