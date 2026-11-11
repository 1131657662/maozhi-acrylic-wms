CREATE TABLE outbound_shipments (
  id CHAR(36) PRIMARY KEY,
  order_id VARCHAR(80) NOT NULL,
  seq INT UNSIGNED NOT NULL,
  vehicle_no VARCHAR(100) NOT NULL,
  shipped_at DATETIME(3) NOT NULL,
  business_date DATE NOT NULL,
  operator VARCHAR(80) NOT NULL,
  operation_id CHAR(36) NOT NULL UNIQUE,
  UNIQUE KEY shipment_order_seq(order_id,seq),
  CONSTRAINT shipment_order_fk FOREIGN KEY(order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
  CONSTRAINT shipment_operation_fk FOREIGN KEY(operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  CONSTRAINT shipment_operator_fk FOREIGN KEY(operator) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE outbound_shipment_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shipment_id CHAR(36) NOT NULL,
  order_line_id VARCHAR(80) NOT NULL,
  packages INT UNSIGNED NOT NULL,
  weight_grams BIGINT UNSIGNED NOT NULL,
  overage_reason VARCHAR(500) NULL,
  CHECK(weight_grams <= 99999999999900 AND MOD(weight_grams,100)=0),
  UNIQUE KEY shipment_line_once(shipment_id,order_line_id),
  INDEX shipment_line_order(order_line_id,shipment_id),
  CONSTRAINT shipment_line_shipment_fk FOREIGN KEY(shipment_id) REFERENCES outbound_shipments(id) ON DELETE RESTRICT,
  CONSTRAINT shipment_line_order_line_fk FOREIGN KEY(order_line_id) REFERENCES outbound_lines(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
ALTER TABLE outbound_lines
  ADD COLUMN line_position INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN scan_packages INT UNSIGNED NULL,
  ADD COLUMN scan_weight_grams BIGINT UNSIGNED NULL;

ALTER TABLE document_correction_lines ADD COLUMN original_line_id VARCHAR(80) NULL;
UPDATE document_correction_lines SET original_line_id=COALESCE(inbound_line_id,outbound_line_id);
ALTER TABLE document_correction_lines
  MODIFY COLUMN original_line_id VARCHAR(80) NOT NULL,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY(correction_id,original_line_id),
  ADD CONSTRAINT correction_original_line_matches CHECK(original_line_id=COALESCE(inbound_line_id,outbound_line_id));
