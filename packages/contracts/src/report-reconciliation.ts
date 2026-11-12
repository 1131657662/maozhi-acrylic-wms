import type { ReportBalance } from './reports.ts';

export function reconciliationLines(balance: ReportBalance) {
  const fields = [
    ['opening', '期初'],
    ['inbound', '+ 有效入库（含撤销）'],
    ['outbound', '− 有效出库（含撤销）'],
    ['adjustment', '± 盘点/期初调整'],
    ['otherMovement', '± 其他库存变动'],
    ['closing', '= 期末'],
    ['difference', '对账差额（期末 − 计算期末）'],
  ] as const;
  return fields.map(([key, label]) => ({
    label,
    packages: balance[`${key}Packages`],
    weightGrams: balance[`${key}Grams`],
  }));
}
