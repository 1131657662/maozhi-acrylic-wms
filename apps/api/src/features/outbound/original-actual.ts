// Pre-016 local confirmations have posted inventory evidence but no shipment row.
// A modern confirmation whose shipment was removed must not be treated as legacy.
export const legacyConfirmationFrom = `FROM stock_journal lj
  JOIN inventory_operations lo ON lo.id=lj.operation_id AND lo.operation_type='outbound.confirm'
  WHERE lj.source_del_flag=0 AND lj.correction_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM outbound_shipments ls WHERE ls.operation_id=lo.id)
  AND NOT EXISTS (SELECT 1 FROM operation_log la WHERE la.action='outbound.confirm' AND la.target_id=lo.target_id
    AND JSON_VALID(la.after_json) AND JSON_UNQUOTE(JSON_EXTRACT(la.after_json,'$.operationId'))=lo.id
    AND JSON_EXTRACT(la.after_json,'$.shipmentId') IS NOT NULL)`;

// Expressions are fixed repository aliases, never user input. Summing these two disjoint
// sources retains the original posted amount when an old local order is shipped again.
export function originalActualSql(input: { orderId: string; lineId?: string; productCode?: string }) {
  const source = `FROM (SELECT sl.packages,sl.weight_grams AS grams
    FROM outbound_shipments sh JOIN outbound_shipment_lines sl ON sl.shipment_id=sh.id
    WHERE sh.order_id=${input.orderId}${input.lineId ? ` AND sl.order_line_id=${input.lineId}` : ''}
    UNION ALL SELECT -lj.packages_delta,-lj.tonnes_delta*1000000 ${legacyConfirmationFrom}
    AND lj.order_id=${input.orderId}${input.productCode ? ` AND lj.product_code=${input.productCode}` : ''}) original_quantity`;
  return { packages: `(SELECT SUM(packages) ${source})`, grams: `(SELECT SUM(grams) ${source})` };
}
