-- Run only against local isolated MySQL 3307. Each warehouse/product must net to zero.
SELECT c.id AS closure_id,o.operation_type,j.warehouse_code,j.product_code,
 SUM(j.packages_delta) AS packages_net,SUM(j.tonnes_delta) AS tonnes_net,
 COUNT(DISTINCT j.operation_id) AS operation_count,
 (SUM(j.packages_delta)=0 AND SUM(j.tonnes_delta)=0 AND COUNT(DISTINCT j.operation_id)=2) AS balanced
FROM document_closures c
JOIN inventory_operations o ON o.id=c.original_operation_id
JOIN stock_journal j ON j.operation_id=c.original_operation_id OR j.operation_id=c.compensation_operation_id
WHERE c.action='reverse'
GROUP BY c.id,o.operation_type,j.warehouse_code,j.product_code;

-- No new journal may lack before/after values or violate its delta.
SELECT COUNT(*) AS mismatches FROM stock_journal
WHERE operation_id IS NOT NULL AND (packages_before IS NULL OR packages_after IS NULL OR tonnes_before IS NULL
 OR tonnes_after IS NULL OR packages_after-packages_before<>packages_delta OR tonnes_after-tonnes_before<>tonnes_delta);

-- Compensation cannot masquerade as a confirm/adjustment, or refer to another document.
SELECT COUNT(*) AS mismatches FROM document_closures c
JOIN inventory_operations o ON o.id=c.original_operation_id
JOIN inventory_operations r ON r.id=c.compensation_operation_id
WHERE c.action='reverse' AND (r.operation_type<>REPLACE(o.operation_type,'.confirm','.reverse')
 OR r.target_id<>o.target_id OR o.target_id<>COALESCE(c.inbound_receipt_id,c.outbound_order_id));

-- Every closure is a terminal document. Void never produces an inventory operation.
SELECT COUNT(*) AS mismatches FROM document_closures c
LEFT JOIN inbound_receipts i ON i.id=c.inbound_receipt_id
LEFT JOIN outbound_orders o ON o.id=c.outbound_order_id
WHERE COALESCE(i.status,o.status)<>IF(c.action='reverse','cancelled','voided')
 OR (c.action='void' AND (c.original_operation_id IS NOT NULL OR c.compensation_operation_id IS NOT NULL));

-- Current cell balance equals its last effective, fully evidenced journal after-value.
SELECT COUNT(*) AS mismatches FROM stock_journal j
JOIN stock s ON s.warehouse_code=j.warehouse_code AND s.product_code=j.product_code AND s.source_del_flag=0
WHERE j.source_del_flag=0 AND j.operation_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM stock_journal later WHERE later.warehouse_code=j.warehouse_code
   AND later.product_code=j.product_code AND later.source_del_flag=0 AND later.id>j.id)
 AND (s.packages<>j.packages_after OR s.weight_tonnes<>j.tonnes_after);
