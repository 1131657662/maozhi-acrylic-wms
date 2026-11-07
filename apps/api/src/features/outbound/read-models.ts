import { auditSchema,stockSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';

export async function stockRows(db:Database) {
  const rows=await db.all(`SELECT warehouse_code AS warehouseCode,product_code AS productCode,
    packages,weight_tonnes AS weightGrams FROM stock WHERE source_del_flag=0 ORDER BY warehouse_code,product_code`);
  return stockSchema.parse(rows.map((row)=>({
    ...row,
    packages: Number(row.packages),
    weightGrams: decimalToGrams(row.weightGrams),
  })));
}
export async function auditRows(db:Database) {
  const rows=await db.all(`SELECT id,action,target_id AS targetId,actor,trace_id AS traceId,
    before_json AS beforeJson,after_json AS afterJson,created_at AS createdAt
    FROM operation_log ORDER BY id DESC LIMIT 100`);
  return auditSchema.parse(rows.map((row)=>({ ...row, id: Number(row.id), createdAt:isoDate(row.createdAt) })));
}
