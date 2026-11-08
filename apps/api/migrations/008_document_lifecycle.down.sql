-- migrateDown checks all affected tables BEFORE any DDL. Nonempty rollback is forbidden.
DROP TABLE outbound_plan_exposures;
DROP TABLE document_closures;
DROP INDEX inventory_operation_target ON inventory_operations;
DROP INDEX journal_cell_sequence ON stock_journal;
ALTER TABLE inbound_receipts DROP CHECK inbound_posting_state,
 ADD CONSTRAINT inbound_receipts_chk_2 CHECK (posting_state IN ('legacy','pending','confirmed'));
ALTER TABLE inventory_operations DROP CHECK inventory_operation_type,
 ADD CONSTRAINT inventory_operations_chk_1 CHECK (operation_type IN ('inbound.confirm','outbound.confirm','stock.adjust'));
