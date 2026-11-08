CREATE TABLE inventory_operations (
  id CHAR(36) PRIMARY KEY,
  operation_type VARCHAR(32) NOT NULL CHECK(operation_type IN ('inbound.confirm','outbound.confirm','stock.adjust')),
  target_id VARCHAR(161) NOT NULL, reason VARCHAR(500) NOT NULL CHECK(CHAR_LENGTH(TRIM(reason)) > 0),
  actor VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
ALTER TABLE inbound_receipts
  ADD COLUMN posting_state VARCHAR(16) NOT NULL DEFAULT 'legacy' CHECK(posting_state IN ('legacy','pending','confirmed')),
  ADD COLUMN confirmation_operation_id CHAR(36) NULL,
  ADD CONSTRAINT inbound_operation_fk FOREIGN KEY(confirmation_operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT;
ALTER TABLE stock_journal
  ADD COLUMN operation_id CHAR(36) NULL,
  ADD COLUMN packages_before INT NULL,
  ADD COLUMN packages_after INT NULL,
  ADD COLUMN tonnes_before DECIMAL(12,4) NULL,
  ADD COLUMN tonnes_after DECIMAL(12,4) NULL,
  ADD CONSTRAINT journal_operation_fk FOREIGN KEY(operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT journal_posting_values CHECK(operation_id IS NULL OR
    (packages_before IS NOT NULL AND packages_after IS NOT NULL AND tonnes_before IS NOT NULL AND tonnes_after IS NOT NULL
     AND packages_before >= 0 AND packages_after >= 0 AND tonnes_before >= 0 AND tonnes_after >= 0
     AND packages_after - packages_before = packages_delta AND tonnes_after - tonnes_before = tonnes_delta));
