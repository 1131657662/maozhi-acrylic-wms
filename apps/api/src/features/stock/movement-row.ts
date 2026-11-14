import type { Row } from '../../db/mysql.ts';
import { journalItem } from './journal-row.ts';

export const movementFrom = `FROM stock_journal j
  JOIN master_products p ON p.code=j.product_code AND p.inventory_eligible=1`;
export const movementFields = `j.id,j.warehouse_code,j.product_code,j.packages_delta,j.tonnes_delta,
  j.created_at,j.source_id,j.source_business_type,j.source_row_json,j.operation_id,j.inbound_receipt_id,
  j.order_id,j.packages_before,j.packages_after,j.tonnes_before,j.tonnes_after`;
export function movementItem(row: Row) {
  const item = journalItem(row);
  return {
    ...item,
    productName: row.product_name ?? null,
    warehouseName: row.warehouse_name ?? null,
    evidence: {
      href: `/stock/journal?${new URLSearchParams({
        warehouseCode: String(row.warehouse_code),
        productCode: String(row.product_code),
      })}`,
    },
  };
}
