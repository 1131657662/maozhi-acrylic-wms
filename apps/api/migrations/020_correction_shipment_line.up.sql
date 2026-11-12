ALTER TABLE document_correction_lines
  ADD COLUMN shipment_line_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_correction_shipment_line (shipment_line_id),
  ADD CONSTRAINT fk_correction_shipment_line FOREIGN KEY (shipment_line_id)
    REFERENCES outbound_shipment_lines(id) ON DELETE RESTRICT;

-- Only a single shipment with one matching original order line is unambiguous.
UPDATE document_correction_lines cl
JOIN document_corrections c ON c.id=cl.correction_id
JOIN (
  SELECT order_id,MIN(id) AS shipment_id,MIN(operation_id) AS operation_id FROM outbound_shipments
  GROUP BY order_id HAVING COUNT(*)=1
) sh ON sh.order_id=c.outbound_order_id
JOIN (
  SELECT shipment_id,order_line_id,MIN(id) AS shipment_line_id FROM outbound_shipment_lines
  GROUP BY shipment_id,order_line_id HAVING COUNT(*)=1
) sl ON sl.shipment_id=sh.shipment_id AND sl.order_line_id=cl.outbound_line_id
JOIN outbound_lines ol ON ol.id=sl.order_line_id AND ol.order_id=c.outbound_order_id
SET cl.shipment_line_id=sl.shipment_line_id
WHERE cl.shipment_line_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_operations o
    WHERE o.target_id=c.outbound_order_id AND o.operation_type='outbound.confirm' AND o.id<>sh.operation_id);
