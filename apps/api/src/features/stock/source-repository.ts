import type { StockSource } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';

// Product provenance, not document origin or code prefixes. Missing masters stay visible.
const sourceExpression =
  "CASE WHEN p.source_kind IN ('erp-product','sku-spec') THEN p.source_kind ELSE 'unclassified' END";
const stockFrom = `FROM stock s LEFT JOIN master_products p ON p.code=s.product_code
  WHERE s.source_del_flag=0 AND ${sourceExpression}=?`;

export async function sourceStockRows(db: Database, source: StockSource) {
  return db.all(
    `SELECT s.warehouse_code,s.product_code,p.name AS product_name,p.source_kind,
    ${sourceExpression} AS source,s.packages,s.weight_tonnes ${stockFrom}
    ORDER BY s.warehouse_code,s.product_code`,
    [source],
  );
}
export async function sourceStockSubtotal(db: Database, source: StockSource) {
  if (source === 'unclassified') return null;
  return db.get(
    `SELECT COALESCE(SUM(s.packages),0) AS packages,
    COALESCE(SUM(s.weight_tonnes),0) AS weight_tonnes ${stockFrom}`,
    [source],
  );
}
export async function sourceJournalRows(db: Database, source: StockSource, limit: number) {
  return db.all(
    `SELECT j.id,j.source_id,j.source_business_type,j.inbound_receipt_id,j.order_id,
    j.warehouse_code,j.product_code,j.packages_delta,j.tonnes_delta,j.created_at,${sourceExpression} AS source
    FROM stock_journal j LEFT JOIN master_products p ON p.code=j.product_code
    WHERE j.source_del_flag=0 AND ${sourceExpression}=? ORDER BY j.id DESC LIMIT ?`,
    [source, limit],
  );
}
