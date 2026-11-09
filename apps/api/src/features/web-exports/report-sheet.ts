import type ExcelJS from 'exceljs';
import { reconciliationLines, type ReportMeta, type DerivedReportMeta } from '@wms/contracts';

export function writeReconciliation(book: ExcelJS.stream.xlsx.WorkbookWriter, report: ReportMeta | DerivedReportMeta): void {
  const sheet = book.addWorksheet('收发存对账');
  sheet.columns = [
    { header: '全部筛选区间对账（不随导出行范围缩小）', width: 54 },
    { header: '包数', width: 22 },
    { header: '吨数', width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();
  sheet
    .addRow([`ERP 商品 · ${report.fromDay} 至 ${report.toDay}`, report.timeStatus, `流水水位 ${report.watermark}`])
    .commit();
  if ('adjustmentCount' in report)
    sheet.addRow(['本期库存变化说明', `本期含调整 ${report.adjustmentCount} 笔、含盘点回写 ${report.stocktakeCount} 次`]).commit();
  for (const item of reconciliationLines(report.reconciliation)) {
    const row = sheet.addRow([
      item.label,
      item.packages ?? '—（不可验证）',
      item.weightGrams === null ? '—（不可验证）' : item.weightGrams / 1_000_000,
    ]);
    row.getCell(2).numFmt = '0';
    row.getCell(3).numFmt = '0.0000';
    row.commit();
  }
  sheet
    .addRow([
      '完整性',
      report.reconciliation.checkState,
      `${report.unverifiedCells}/${report.totalCells} 个仓库商品单元不可验证`,
    ])
    .commit();
  sheet.addRow(['范围说明', '仅ERP商品；对账含全部收发/调整，不受明细方向筛选影响；主表按选择方向及范围']).commit();
  if ('adjustmentCount' in report) {
    sheet.addRow(['公式与口径', report.formula]).commit();
  }
  sheet
    .addRow([
      '诊断',
      `排除软删 ${report.excludedDeleted}；缺时间 ${report.missingTime}；来源未识别 ${report.unassignedRows}`,
    ])
    .commit();
  for (const reason of report.reconciliation.reasons) sheet.addRow(['不可验证/差额原因', reason]).commit();
  sheet.addRow(['期初/期末为边界证据；未知不是零；未生成补平调整']).commit();
  sheet.commit();
}
