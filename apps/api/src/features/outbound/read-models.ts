import { webAuditQuerySchema, stockSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { listWebAudit } from '../web-lists/audit.ts';

export async function stockRows(db: Database) {
  const rows = await db.all(`SELECT warehouse_code AS warehouseCode,product_code AS productCode,
    packages,weight_tonnes AS weightGrams FROM stock WHERE source_del_flag=0 ORDER BY warehouse_code,product_code`);
  return stockSchema.parse(
    rows.map((row) => ({
      ...row,
      packages: Number(row.packages),
      weightGrams: decimalToGrams(row.weightGrams),
    })),
  );
}
export async function auditRows(db: Database) {
  return (await listWebAudit(db, webAuditQuerySchema.parse({ pageSize: 100 }))).items;
}
