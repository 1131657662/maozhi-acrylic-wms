import { legacyConfirmationFrom } from '../outbound/original-actual.ts';

// Every quantity source is reduced to one row per order line before the final join.
export function pendingStockSql(pairCount: number): string {
  const pairs = Array.from({ length: pairCount }, () => '(?,?)').join(',');
  return `WITH selected_lines AS (
    SELECT l.id,l.order_id,l.product_code,o.warehouse_code,l.planned_packages,l.planned_weight_tonnes
    FROM outbound_orders o JOIN outbound_lines l ON l.order_id=o.id AND l.source_del_flag=0
    WHERE o.source_del_flag=0 AND o.status IN ('open','partially_shipped')
    AND (o.warehouse_code,l.product_code) IN (${pairs})
  ), shipped AS (
    SELECT sl.order_line_id,SUM(sl.packages) AS packages,SUM(sl.weight_grams) AS grams
    FROM selected_lines l JOIN outbound_shipment_lines sl ON sl.order_line_id=l.id
    JOIN outbound_shipments sh ON sh.id=sl.shipment_id AND sh.order_id=l.order_id
    GROUP BY sl.order_line_id
  ), corrected AS (
    SELECT cl.outbound_line_id,SUM(cl.packages_delta) AS packages,SUM(cl.tonnes_delta)*1000000 AS grams
    FROM selected_lines l JOIN document_correction_lines cl ON cl.outbound_line_id=l.id
    JOIN document_corrections c ON c.id=cl.correction_id AND c.outbound_order_id=l.order_id
    WHERE c.offset_operation_id IS NULL GROUP BY cl.outbound_line_id
  ), original_posted AS (
    SELECT lj.order_id,lj.product_code,-SUM(lj.packages_delta) AS packages,-SUM(lj.tonnes_delta)*1000000 AS grams
    ${legacyConfirmationFrom}
    AND (lj.order_id,lj.product_code) IN (SELECT order_id,product_code FROM selected_lines)
    GROUP BY lj.order_id,lj.product_code
  )
  SELECT l.warehouse_code AS warehouseCode,l.product_code AS productCode,
    SUM(GREATEST(l.planned_packages-COALESCE(s.packages,0)-COALESCE(c.packages,0)-COALESCE(p.packages,0),0)) AS packages,
    SUM(GREATEST(l.planned_weight_tonnes*1000000-COALESCE(s.grams,0)-COALESCE(c.grams,0)-COALESCE(p.grams,0),0)) AS weightGrams
  FROM selected_lines l LEFT JOIN shipped s ON s.order_line_id=l.id
  LEFT JOIN corrected c ON c.outbound_line_id=l.id
  LEFT JOIN original_posted p ON p.order_id=l.order_id AND p.product_code=l.product_code
  GROUP BY l.warehouse_code,l.product_code`;
}
