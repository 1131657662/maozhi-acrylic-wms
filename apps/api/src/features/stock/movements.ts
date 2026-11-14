import { stockMovementPageSchema, type StockMovementQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { movementFields, movementFrom, movementItem } from './movement-row.ts';

export async function readStockMovements(db: Database, query: StockMovementQuery) {
  const filters = ['j.source_del_flag=0'];
  const values: (string | number)[] = [];
  for (const [column, value] of [
    ['j.warehouse_code', query.warehouseCode],
    ['j.product_code', query.productCode],
  ] as const) {
    if (value !== undefined) {
      filters.push(`${column}=?`);
      values.push(value);
    }
  }
  const where = `WHERE ${filters.join(' AND ')}`;
  return db.readSnapshot(async (tx) => {
    const total = await tx.get(`SELECT COUNT(*) AS total ${movementFrom} ${where}`, values);
    const rows = await tx.all(
      `SELECT ${movementFields},o.operation_type,o.reason,
      p.name AS product_name,w.name AS warehouse_name ${movementFrom}
      LEFT JOIN inventory_operations o ON o.id=j.operation_id
      LEFT JOIN master_warehouses w ON w.code=j.warehouse_code
      ${where} ORDER BY j.id DESC LIMIT ? OFFSET ?`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return stockMovementPageSchema.parse({
      items: rows.map(movementItem),
      total: Number(total?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}
