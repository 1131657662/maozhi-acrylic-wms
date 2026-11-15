import type ExcelJS from 'exceljs';
import {
  agingBandLabels,
  reportMovementLabels,
  reportTypeLabels,
  reportSelections,
  listTime,
  publicReportText,
  type ReportView,
  type ReportKind,
} from '@wms/contracts';

export const reportNames: Record<ReportKind, string> = {
  'report-details': '出入库明细',
  'report-monthly': '月度汇总',
  'report-turnover': '周转率',
  'report-aging': '库存库龄',
};
export const REPORT_HEADER_ROW = 3;
export interface ReportHeaderContext {
  kind: ReportKind;
  query: Record<string, string>;
  actor: string;
  generatedAt: string;
}
function labels(value: string | undefined, mapping: Record<string, string>): string {
  return (
    reportSelections(value)
      .map((key) => mapping[key] ?? '未识别')
      .join('、') || '全部'
  );
}
export function reportFiltersText(query: Record<string, string>): string {
  return [
    `日期范围：${query.fromDay} 至 ${query.toDay}`,
    `仓库：${query.warehouse || '全部'}；仓库选择：${query.warehouseCodes || '全部'}`,
    `商品：${query.product || '全部'}；商品编码：${query.productCode || '全部'}`,
    `方向：${labels(query.movements ?? (query.movement === 'all' ? '' : query.movement), reportMovementLabels)}`,
    `类型：${labels(query.types, reportTypeLabels)}`,
    ...(query.cutoffDay
      ? [
          `库龄截止日：${query.cutoffDay}；库龄分段：${agingBandLabels[query.band as keyof typeof agingBandLabels] ?? agingBandLabels.all}`,
        ]
      : []),
  ].join('；');
}
export function writeReportHeader(
  sheet: ExcelJS.Worksheet,
  context: ReportHeaderContext,
  view: ReportView,
  columns: number,
): void {
  const info = [
    reportNames[context.kind],
    `口径：${view.basis === 'restated' ? '重述' : '入账日'}`,
    ...(view.basis === 'restated' ? ['重述视图 · 按有效业务日期'] : []),
    `数据截至：${view.watermarks.asOf}`,
    `流水水位：${view.watermarks.journalMaxId}`,
    `日期更正：${view.watermarks.dateCorrectionCount} 条`,
    `生成时间：${listTime(context.generatedAt)}`,
    `操作人：${context.actor}`,
  ].join('；');
  for (const text of [info, reportFiltersText(context.query)]) {
    const row = sheet.addRow([publicReportText(text)]);
    if (columns > 1) sheet.mergeCells(row.number, 1, row.number, columns);
    row.alignment = { wrapText: true, vertical: 'middle' };
    row.height = 60;
    row.commit();
  }
}
