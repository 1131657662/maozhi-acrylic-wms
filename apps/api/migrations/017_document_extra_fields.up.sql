SET SESSION lock_wait_timeout=5;

ALTER TABLE inbound_receipts
  ADD COLUMN bill_type VARCHAR(32) NULL,
  ADD COLUMN container_no VARCHAR(64) NULL,
  ADD INDEX idx_inbound_receipts_bill_type (bill_type);

ALTER TABLE inbound_lines
  ADD COLUMN memo VARCHAR(500) NULL;

ALTER TABLE outbound_orders
  ADD COLUMN bill_type VARCHAR(32) NULL,
  ADD COLUMN container_no VARCHAR(64) NULL,
  ADD INDEX idx_outbound_orders_bill_type (bill_type);

ALTER TABLE outbound_lines
  ADD COLUMN contract_no VARCHAR(80) NULL,
  ADD COLUMN memo VARCHAR(500) NULL;
