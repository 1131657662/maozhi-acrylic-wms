ALTER TABLE inbound_receipts ADD COLUMN business_date DATE NULL,
 ADD COLUMN correction_revision INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE outbound_orders ADD COLUMN business_date DATE NULL,
 ADD COLUMN correction_revision INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE document_number_rules DROP CHECK chk_number_kind,
 ADD CONSTRAINT chk_number_kind CHECK(kind IN ('inbound','outbound','correction'));
ALTER TABLE inventory_operations DROP CHECK inventory_operation_type,
 ADD CONSTRAINT inventory_operation_type CHECK(operation_type IN
 ('inbound.confirm','outbound.confirm','stock.adjust','inbound.reverse','outbound.reverse','stocktake.post','stock.correct'));
CREATE TABLE document_corrections (
 id CHAR(36) PRIMARY KEY, number VARCHAR(100) NOT NULL UNIQUE,
 inbound_receipt_id VARCHAR(80) NULL, outbound_order_id VARCHAR(80) NULL,
 previous_correction_id CHAR(36) NULL, revision INT UNSIGNED NOT NULL CHECK(revision>0),
 reason VARCHAR(500) NOT NULL CHECK(CHAR_LENGTH(TRIM(reason))>0),
 actor VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL,
 operation_id CHAR(36) NOT NULL UNIQUE, offset_operation_id CHAR(36) NULL,
 CONSTRAINT correction_original CHECK((inbound_receipt_id IS NULL) <> (outbound_order_id IS NULL)),
 UNIQUE KEY correction_inbound_revision(inbound_receipt_id,revision),
 UNIQUE KEY correction_outbound_revision(outbound_order_id,revision),
 FOREIGN KEY(inbound_receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
 FOREIGN KEY(outbound_order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
 FOREIGN KEY(previous_correction_id) REFERENCES document_corrections(id) ON DELETE RESTRICT,
 FOREIGN KEY(operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
 FOREIGN KEY(offset_operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE document_correction_lines (
 correction_id CHAR(36) NOT NULL, product_code VARCHAR(80) NOT NULL,
 inbound_line_id VARCHAR(80) NULL, outbound_line_id VARCHAR(80) NULL,
 packages_before INT NOT NULL CHECK(packages_before>=0), packages_after INT NOT NULL CHECK(packages_after>=0),
 tonnes_before DECIMAL(12,4) NOT NULL CHECK(tonnes_before>=0), tonnes_after DECIMAL(12,4) NOT NULL CHECK(tonnes_after>=0),
 packages_delta INT NOT NULL, tonnes_delta DECIMAL(12,4) NOT NULL,
 PRIMARY KEY(correction_id,product_code),
 CONSTRAINT correction_line_original CHECK((inbound_line_id IS NULL) <> (outbound_line_id IS NULL)),
 CONSTRAINT correction_line_delta CHECK(packages_after-packages_before=packages_delta AND tonnes_after-tonnes_before=tonnes_delta),
 CONSTRAINT correction_line_nonzero CHECK(packages_delta<>0 OR tonnes_delta<>0),
 FOREIGN KEY(correction_id) REFERENCES document_corrections(id) ON DELETE RESTRICT,
 FOREIGN KEY(inbound_line_id) REFERENCES inbound_lines(id) ON DELETE RESTRICT,
 FOREIGN KEY(outbound_line_id) REFERENCES outbound_lines(id) ON DELETE RESTRICT,
 FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
ALTER TABLE stock_journal ADD COLUMN correction_id CHAR(36) NULL,
 ADD CONSTRAINT journal_correction_fk FOREIGN KEY(correction_id) REFERENCES document_corrections(id) ON DELETE RESTRICT;
