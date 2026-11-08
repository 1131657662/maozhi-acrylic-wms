ALTER TABLE stock_journal
  DROP CHECK journal_posting_values,
  DROP FOREIGN KEY journal_operation_fk,
  DROP COLUMN operation_id, DROP COLUMN packages_before, DROP COLUMN packages_after,
  DROP COLUMN tonnes_before, DROP COLUMN tonnes_after;
ALTER TABLE inbound_receipts
  DROP FOREIGN KEY inbound_operation_fk,
  DROP COLUMN confirmation_operation_id, DROP COLUMN posting_state;
DROP TABLE inventory_operations;
