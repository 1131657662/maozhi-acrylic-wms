-- Keep historical documents and journal rows unchanged. Existing dispatch is unknown.
ALTER TABLE inventory_operations DROP CHECK inventory_operations_chk_1,
 ADD CONSTRAINT inventory_operation_type CHECK (operation_type IN
 ('inbound.confirm','outbound.confirm','stock.adjust','inbound.reverse','outbound.reverse'));
ALTER TABLE inbound_receipts DROP CHECK inbound_receipts_chk_2,
 ADD CONSTRAINT inbound_posting_state CHECK (posting_state IN ('legacy','pending','confirmed','reversed','voided'));
CREATE INDEX journal_cell_sequence ON stock_journal(warehouse_code,product_code,source_del_flag,id);
CREATE INDEX inventory_operation_target ON inventory_operations(operation_type,target_id);
CREATE TABLE document_closures (
 id CHAR(36) PRIMARY KEY,
 inbound_receipt_id VARCHAR(80) NULL UNIQUE,
 outbound_order_id VARCHAR(80) NULL UNIQUE,
 action VARCHAR(16) NOT NULL,
 reason VARCHAR(500) NOT NULL CHECK (CHAR_LENGTH(TRIM(reason))>0),
 original_operation_id CHAR(36) NULL UNIQUE,
 compensation_operation_id CHAR(36) NULL UNIQUE,
 actor VARCHAR(80) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 CONSTRAINT closure_document CHECK ((inbound_receipt_id IS NULL) <> (outbound_order_id IS NULL)),
 CONSTRAINT closure_operations CHECK (
   (action='reverse' AND original_operation_id IS NOT NULL AND compensation_operation_id IS NOT NULL
    AND original_operation_id<>compensation_operation_id)
   OR (action='void' AND original_operation_id IS NULL AND compensation_operation_id IS NULL)),
 FOREIGN KEY(inbound_receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
 FOREIGN KEY(outbound_order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
 FOREIGN KEY(original_operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
 FOREIGN KEY(compensation_operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE outbound_plan_exposures (
 plan_id VARCHAR(80) PRIMARY KEY,
 basis VARCHAR(32) NOT NULL CHECK (basis IN ('pre-migration-unknown','pda-read')),
 first_exposed_at DATETIME(3) NOT NULL,
 FOREIGN KEY(plan_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT INTO outbound_plan_exposures(plan_id,basis,first_exposed_at)
 SELECT id,'pre-migration-unknown',UTC_TIMESTAMP(3) FROM outbound_orders;
