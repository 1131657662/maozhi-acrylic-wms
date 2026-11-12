import type { Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';

export function selectedLine(order: Detail, productCode: string) {
  const line = order.lines.find((item) => item.productCode === productCode);
  if (!line) {
    const products = [
      ...new Map(order.lines.map((l) => [l.productCode, { code: l.productCode, name: l.productName }])).values(),
    ];
    throw new AppError('PRODUCT_MISMATCH', `请选择本单商品：${products.map((p) => p.name).join('、')}`, 422, {
      products,
    });
  }
  return line;
}
export const catalogFrom = `FROM catalog_head h JOIN catalog_versions v ON v.version_id=h.active_version_id AND v.status='published'
  JOIN catalog_entries e ON e.version_id=v.version_id
  LEFT JOIN master_products p ON p.code=e.legacy_product_code AND p.inventory_eligible=1`;

export async function barcodeEntry(db: Database, barcode: string, productCode: string) {
  const row = await db.get(
    `SELECT e.*,p.code AS mapped_code,p.name AS mapped_name ${catalogFrom} WHERE h.id=1 AND e.barcode=?`,
    [barcode],
  );
  if (!row) throw new AppError('UNKNOWN_BARCODE', '目录无此条码，请先更新目录', 422);
  if (row.mapped_code && row.mapped_code !== productCode)
    throw new AppError('PRODUCT_MISMATCH', `条码属于商品：${String(row.mapped_name)}，请切换当前商品`, 422, {
      mappedProduct: { code: row.mapped_code, name: row.mapped_name },
    });
  return {
    versionId: Number(row.version_id),
    weightTonnes: row.weight_tonnes,
    sourceSpec: row.source_spec == null ? null : String(row.source_spec),
    attribution: row.mapped_code ? ('catalog' as const) : ('manual' as const),
  };
}
