import ExcelJS from 'exceljs';
import { WEB_EXPORT_MAX_ROWS, listTime } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';

export async function exportScanRecords(db: Database, id: string) {
  return db.readSnapshot(async (tx) => {
    const order = await tx.get('SELECT order_no FROM outbound_orders WHERE id=? AND source_del_flag=0', [id]);
    if (!order) throw new AppError('NOT_FOUND', '出库单不存在', 404);
    const count = Number(
      (await tx.get('SELECT COUNT(*) AS total FROM scan_facts WHERE plan_id=? AND revoked_at IS NULL', [id]))?.total ??
        0,
    );
    if (count > WEB_EXPORT_MAX_ROWS)
      throw new AppError(
        'EXPORT_TOO_LARGE',
        `本单有 ${count} 条扫码记录，超过 ${WEB_EXPORT_MAX_ROWS} 条导出上限`,
        422,
        { actualRows: count },
      );
    const rows = await tx.all(
      `SELECT f.barcode,l.product_name,l.product_code,f.weight_tonnes,f.scanned_at,
      e.barcode AS catalog_barcode FROM scan_facts f
      LEFT JOIN scan_fact_context c ON c.fact_id=f.id
      LEFT JOIN outbound_lines l ON l.id=c.outbound_line_id
      LEFT JOIN catalog_entries e ON e.version_id=f.catalog_version AND e.barcode=f.barcode
      WHERE f.plan_id=? AND f.revoked_at IS NULL ORDER BY f.scanned_at,f.id`,
      [id],
    );
    return { filename: `${String(order.order_no)}-扫码清单.xlsx`, buffer: await workbook(rows) };
  });
}
async function workbook(rows: Record<string, unknown>[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('扫码清单');
  sheet.columns = [
    { header: '条码', width: 28 },
    { header: '商品', width: 30 },
    { header: '商品编码', width: 20 },
    { header: '包数', width: 12 },
    { header: '重量（kg）', width: 18 },
    { header: '重量（吨）', width: 18 },
    { header: '扫描时间', width: 25 },
    { header: '说明', width: 18 },
  ];
  let grams = 0;
  for (const row of rows) {
    const weight = row.catalog_barcode ? decimalToGrams(row.weight_tonnes) : 0;
    grams += weight;
    sheet.addRow([
      String(row.barcode),
      String(row.product_name ?? '未记录'),
      String(row.product_code ?? ''),
      1,
      weight / 1000,
      weight / 1_000_000,
      listTime(isoDate(row.scanned_at)),
      row.catalog_barcode ? '' : '目录缺失',
    ]);
  }
  sheet.addRow(['合计', '', '', rows.length, grams / 1000, grams / 1_000_000, '', '']);
  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(3).numFmt = '@';
  sheet.getColumn(5).numFmt = '0.000';
  sheet.getColumn(6).numFmt = '0.0000';
  return Buffer.from(await book.xlsx.writeBuffer());
}
