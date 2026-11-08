import { z } from 'zod';
import { inboundReceiptSchema, type InboundReceipt } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';
import { AppError } from '../../shared/errors.ts';

const headerSchema = inboundReceiptSchema.omit({ packages: true, weightGrams: true, lines: true });
const lineSchema = inboundReceiptSchema.shape.lines.element.extend({
  packages: z.coerce.number().int(),
  weightGrams: z.string().transform(decimalToGrams),
});
const headerSql = `SELECT r.id,r.receipt_no AS receiptNo,r.status,r.posting_state AS postingState,
  r.confirmation_operation_id AS confirmationOperationId,r.supplier_code AS supplierCode,s.name AS supplierName,
  r.warehouse_code AS warehouseCode,w.name AS warehouseName,r.memo,r.created_by AS createdBy,r.created_at AS createdAt
  FROM inbound_receipts r JOIN master_suppliers s ON s.code=r.supplier_code AND s.source_del_flag=0
  JOIN master_warehouses w ON w.code=r.warehouse_code AND w.source_del_flag=0`;
export async function getInbound(db: Database, id: string): Promise<InboundReceipt> {
  const header = await db.get(`${headerSql} WHERE r.source_del_flag=0 AND r.id=?`, [id]);
  if (!header) throw new AppError('NOT_FOUND', '入库单不存在', 404);
  const lines = z.array(lineSchema).parse(
    await db.all(
      `SELECT l.id,l.product_code AS productCode,COALESCE(p.name,l.product_code) AS productName,
    l.packages,l.weight_tonnes AS weightGrams FROM inbound_lines l
    LEFT JOIN master_products p ON p.code=l.product_code AND p.source_del_flag=0 WHERE l.receipt_id=? AND l.source_del_flag=0 ORDER BY l.product_code`,
      [id],
    ),
  );
  return inboundReceiptSchema.parse({
    ...headerSchema.parse({ ...header, createdAt: isoDate(header.createdAt) }),
    lines,
    packages: lines.reduce((sum, line) => sum + line.packages, 0),
    weightGrams: lines.reduce((sum, line) => sum + line.weightGrams, 0),
  });
}
export async function listInbound(db: Database, query: { page: number; pageSize: number; keyword: string }) {
  const pattern = query.keyword.replace(/[!%_]/g, '!$&') + '%';
  const total = Number(
    (
      await db.get(
        "SELECT COUNT(*) AS total FROM inbound_receipts WHERE source_del_flag=0 AND receipt_no LIKE ? ESCAPE '!'",
        [pattern],
      )
    )?.total ?? 0,
  );
  const rows = await db.all(
    `${headerSql} WHERE r.source_del_flag=0 AND r.receipt_no LIKE ? ESCAPE '!' ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?`,
    [pattern, query.pageSize, (query.page - 1) * query.pageSize],
  );
  const items = await Promise.all(
    z
      .array(headerSchema)
      .parse(rows)
      .map((row) => getInbound(db, row.id)),
  );
  return { items, total, page: query.page, pageSize: query.pageSize };
}
