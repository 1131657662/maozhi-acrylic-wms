ALTER TABLE master_products
  ADD COLUMN source_kind VARCHAR(16) NOT NULL DEFAULT 'app',
  ADD COLUMN source_model VARCHAR(200) NULL,
  ADD COLUMN source_status VARCHAR(32) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1));
ALTER TABLE master_warehouses
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1));
ALTER TABLE master_customers
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1));
ALTER TABLE master_suppliers
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1));

ALTER TABLE outbound_orders
  DROP CHECK outbound_orders_chk_1,
  MODIFY status VARCHAR(32) NOT NULL DEFAULT 'open',
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_order_status VARCHAR(32) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD UNIQUE KEY outbound_source_id(source_id);
ALTER TABLE outbound_lines
  DROP FOREIGN KEY outbound_lines_ibfk_1,
  DROP FOREIGN KEY outbound_product_fk,
  ADD INDEX outbound_line_order_id(order_id),
  DROP INDEX line_order_product,
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD UNIQUE KEY outbound_line_source_id(source_id);

ALTER TABLE inbound_receipts
  ADD COLUMN status VARCHAR(32) NULL,
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD UNIQUE KEY inbound_source_id(source_id);
ALTER TABLE inbound_lines
  DROP FOREIGN KEY inbound_lines_ibfk_1,
  DROP FOREIGN KEY inbound_lines_ibfk_2,
  ADD INDEX inbound_line_receipt_id(receipt_id),
  DROP INDEX inbound_receipt_product,
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD UNIQUE KEY inbound_line_source_id(source_id);

ALTER TABLE stock
  DROP FOREIGN KEY stock_product_fk,
  DROP FOREIGN KEY stock_warehouse_fk,
  DROP PRIMARY KEY,
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD PRIMARY KEY (warehouse_code,product_code,source_del_flag),
  ADD UNIQUE KEY stock_source_id(source_id);
ALTER TABLE stock_journal
  DROP FOREIGN KEY stock_journal_ibfk_1,
  DROP FOREIGN KEY stock_journal_inbound_fk,
  DROP INDEX journal_order_product,
  DROP INDEX journal_inbound_product,
  DROP CHECK stock_journal_source_chk,
  ADD COLUMN source_id VARCHAR(80) NULL,
  ADD COLUMN source_order_no VARCHAR(100) NULL,
  ADD COLUMN source_business_type VARCHAR(32) NULL,
  ADD COLUMN source_del_flag TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN source_row_json LONGTEXT NULL,
  ADD CHECK (source_del_flag IN (0,1)),
  ADD UNIQUE KEY journal_source_id(source_id);

ALTER TABLE scan_catalog
  ADD COLUMN source_spec VARCHAR(255) NULL;
