import { journalSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';

export async function journalRows(db: Database, limit: number) {
  const rows = await db.all(
    `SELECT id,source_id,source_business_type,inbound_receipt_id,order_id,
    warehouse_code,product_code,packages_delta,tonnes_delta,created_at
    FROM stock_journal WHERE source_del_flag=0 ORDER BY id DESC LIMIT ?`,
    [limit],
  );
  return journalSchema.parse(
    rows.map((row) => ({
      id: String(row.id),
      type:
        row.source_id !== null
          ? row.source_business_type
          : (row.source_business_type ?? (row.inbound_receipt_id ? 'inbound' : row.order_id ? 'outbound' : null)),
      warehouseCode: row.warehouse_code,
      productCode: row.product_code,
      packagesDelta: Number(row.packages_delta),
      weightDeltaGrams: decimalToGrams(row.tonnes_delta),
      createdAt: isoDate(row.created_at),
    })),
  );
}
