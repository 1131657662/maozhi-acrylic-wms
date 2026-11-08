import type { ReportQuery } from '@wms/contracts';
import { contains } from '../web-lists/query.ts';

const json = (alias: string, field: string) =>
  `CASE WHEN JSON_VALID(${alias}.source_row_json) THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.source_row_json,'$.${field}')),'null') ELSE NULL END`;
export const postedLocal = `CASE WHEN s.source_id IS NOT NULL THEN ${json('s', 'create_time')}
  ELSE DATE_FORMAT(DATE_ADD(COALESCE(o.created_at,s.created_at),INTERVAL 8 HOUR),'%Y-%m-%d %H:%i:%s.%f') END`;
export const validPosted = `(${postedLocal} REGEXP '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?$'
  AND CAST(SUBSTRING(${postedLocal},9,2) AS UNSIGNED)<=DAY(LAST_DAY(CONCAT(LEFT(${postedLocal},7),'-01'))))`;
export const balanceFields = `s.id,s.warehouse_code AS warehouseCode,w.name AS warehouseName,
  s.product_code AS productCode,p.name AS productName,p.source_model AS productModel,
  s.source_id,s.source_del_flag,s.source_business_type,s.source_row_json,
  s.packages_delta,s.tonnes_delta,s.packages_before,s.packages_after,s.tonnes_before,s.tonnes_after,
  s.operation_id,o.operation_type,o.reason,o.actor,${postedLocal} AS reportLocalTime`;
export const ledgerFields = `${balanceFields},
  COALESCE(i.receipt_no,hi.receipt_no,b.order_no,hb.order_no,s.source_order_no,'') AS orderNo,
  COALESCE(i.id,hi.id,b.id,hb.id) AS documentId,COALESCE(i.status,hi.status,b.status,hb.status,'') AS documentStatus,
  COALESCE(i.source_row_json,hi.source_row_json,b.source_row_json,hb.source_row_json) AS documentSource,
  COALESCE(i.created_at,hi.created_at,b.created_at,hb.created_at) AS documentCreated,
  COALESCE(i.created_by,hi.created_by,'') AS documentActor,COALESCE(b.vehicle_no,hb.vehicle_no,'') AS vehicleNo,
  COALESCE(i.memo,hi.memo,'') AS memo,COALESCE(b.customer_name,hb.customer_name,su.name,'') AS partner,
  c.original_operation_id AS originalOperationId`;
export const balanceFrom = `FROM stock_journal s
  JOIN master_products p ON p.code=s.product_code AND p.source_kind='erp-product'
  LEFT JOIN master_warehouses w ON w.code=s.warehouse_code
  LEFT JOIN inventory_operations o ON o.id=s.operation_id`;
export const ledgerFrom = `${balanceFrom}
  LEFT JOIN inbound_receipts i ON i.id=s.inbound_receipt_id
  LEFT JOIN inbound_receipts hi ON hi.receipt_no=s.source_order_no AND s.source_id IS NOT NULL AND s.source_business_type='inbound'
  LEFT JOIN outbound_orders b ON b.id=s.order_id
  LEFT JOIN outbound_orders hb ON hb.order_no=s.source_order_no AND s.source_id IS NOT NULL AND s.source_business_type='outbound'
  LEFT JOIN master_suppliers su ON su.code=COALESCE(i.supplier_code,hi.supplier_code)
  LEFT JOIN document_closures c ON c.compensation_operation_id=o.id`;
export function dimensionFilter(query: Pick<ReportQuery, 'warehouse' | 'product'>) {
  const clauses: string[] = [],
    values: string[] = [];
  if (query.warehouse) {
    clauses.push("(s.warehouse_code LIKE ? ESCAPE '!' OR w.name LIKE ? ESCAPE '!')");
    values.push(contains(query.warehouse), contains(query.warehouse));
  }
  if (query.product) {
    clauses.push("(s.product_code LIKE ? ESCAPE '!' OR p.name LIKE ? ESCAPE '!')");
    values.push(contains(query.product), contains(query.product));
  }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', values };
}
export const movementPredicate = `(o.operation_type IN ('inbound.confirm','inbound.reverse','outbound.confirm','outbound.reverse')
  OR (s.operation_id IS NULL AND s.source_business_type IN ('inbound','outbound')))`;
