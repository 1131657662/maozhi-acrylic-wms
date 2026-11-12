import type ExcelJS from 'exceljs';
import type { ReportView } from '@wms/contracts';
import { reportCopy } from '../reports/copy.ts';

type Book = ExcelJS.stream.xlsx.WorkbookWriter;
export function writeReportView(book: Book, view: ReportView): void {
  const sheet = book.addWorksheet('报表口径');
  sheet.columns = [
    { header: '项目', width: 28 },
    { header: '说明', width: 90 },
  ];
  sheet.getRow(1).commit();
  sheet.addRow(['统计口径', view.basis === 'restated' ? reportCopy.restatedBasis : reportCopy.postedBasis]).commit();
  sheet
    .addRow([
      '数据截至（上海时间）',
      new Date(Date.parse(view.watermarks.asOf) + 8 * 3600000).toISOString().slice(0, 23).replace('T', ' '),
    ])
    .commit();
  sheet.addRow(['库存口径', reportCopy.inventoryBasis]).commit();
  sheet.addRow(['余额说明', '主表期初、期末及对账差额均为实际入账余额；收发存对账单独使用入账发生额']).commit();
  if (view.restatedBalance) writeBalance(sheet, view);
  sheet.commit();
  if (view.bridge) writeBridge(book, view);
}
function writeBalance(sheet: ExcelJS.Worksheet, view: ReportView): void {
  const balance = view.restatedBalance!;
  sheet.addRow(['重述余额（非当时实际库存）', balance.checkState]).commit();
  for (const [key, label] of [
    ['opening', '重述期初'],
    ['closing', '重述期末'],
    ['difference', '重述对账差额'],
  ] as const)
    sheet
      .addRow([
        label,
        balance[`${key}Packages`] ?? '—（不可验证）',
        balance[`${key}Grams`] === null ? '—（不可验证）' : balance[`${key}Grams`]! / 1_000_000,
      ])
      .commit();
  for (const reason of balance.reasons) sheet.addRow(['不可验证原因', reason]).commit();
}
function writeBridge(book: Book, view: ReportView): void {
  const sheet = book.addWorksheet('归期桥接');
  sheet.columns = [
    { header: '月份', width: 14 },
    { header: '分类', width: 12 },
    { header: '在查询区间内', width: 18 },
    { header: '入账包数', width: 16 },
    { header: '入账吨数', width: 18 },
    { header: '重述包数', width: 16 },
    { header: '重述吨数', width: 18 },
    { header: '差额包数', width: 16 },
    { header: '差额吨数', width: 18 },
    { header: '说明', width: 70 },
  ];
  sheet.getRow(1).commit();
  for (const item of view.bridge ?? []) {
    const row = sheet.addRow([
      item.month ?? '未归期',
      item.category,
      item.inRange ? '是' : '否',
      item.postedPackages,
      item.postedGrams / 1_000_000,
      item.restatedPackages,
      item.restatedGrams / 1_000_000,
      item.deltaPackages,
      item.deltaGrams / 1_000_000,
      item.reason ?? '',
    ]);
    for (const column of [5, 7, 9]) row.getCell(column).numFmt = '0.0000';
    row.commit();
  }
  sheet.commit();
}
