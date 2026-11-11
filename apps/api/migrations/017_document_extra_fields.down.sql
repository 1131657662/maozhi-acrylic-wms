SET SESSION lock_wait_timeout=5;

ALTER TABLE inbound_receipts
  DROP INDEX idx_inbound_receipts_bill_type,
  DROP COLUMN bill_type,
  DROP COLUMN container_no;

ALTER TABLE inbound_lines
  DROP COLUMN memo;

ALTER TABLE outbound_orders
  DROP INDEX idx_outbound_orders_bill_type,
  DROP COLUMN bill_type,
  DROP COLUMN container_no;

ALTER TABLE outbound_lines
  DROP COLUMN contract_no,
  DROP COLUMN memo;
