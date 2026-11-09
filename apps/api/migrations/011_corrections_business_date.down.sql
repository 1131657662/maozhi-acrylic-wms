-- migrateDown preflights all B5a data BEFORE changing state or running any DDL.
ALTER TABLE stock_journal DROP FOREIGN KEY journal_correction_fk, DROP COLUMN correction_id;
DROP TABLE document_correction_lines;
DROP TABLE document_corrections;
ALTER TABLE inbound_receipts DROP COLUMN business_date, DROP COLUMN correction_revision;
ALTER TABLE outbound_orders DROP COLUMN business_date, DROP COLUMN correction_revision;
ALTER TABLE document_number_rules DROP CHECK chk_number_kind,
 ADD CONSTRAINT chk_number_kind CHECK(kind IN ('inbound','outbound'));
ALTER TABLE inventory_operations DROP CHECK inventory_operation_type,
 ADD CONSTRAINT inventory_operation_type CHECK(operation_type IN
 ('inbound.confirm','outbound.confirm','stock.adjust','inbound.reverse','outbound.reverse','stocktake.post'));
