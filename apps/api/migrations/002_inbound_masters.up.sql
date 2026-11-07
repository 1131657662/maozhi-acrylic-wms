CREATE TABLE master_products (
  code VARCHAR(80) PRIMARY KEY, name VARCHAR(200) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE master_warehouses (
  code VARCHAR(80) PRIMARY KEY, name VARCHAR(200) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE master_customers (
  code VARCHAR(80) PRIMARY KEY, name VARCHAR(200) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE master_suppliers (
  code VARCHAR(80) PRIMARY KEY, name VARCHAR(200) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;

INSERT INTO master_products(code,name,active,created_at,updated_at)
SELECT codes.product_code,COALESCE(line_names.product_name,codes.product_code),1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)
FROM (SELECT product_code FROM outbound_lines UNION SELECT product_code FROM stock UNION SELECT product_code FROM scan_catalog) codes
LEFT JOIN (SELECT product_code,MIN(product_name) AS product_name FROM outbound_lines GROUP BY product_code) line_names
  ON line_names.product_code=codes.product_code;
INSERT INTO master_warehouses(code,name,active,created_at,updated_at)
SELECT codes.warehouse_code,codes.warehouse_code,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)
FROM (SELECT warehouse_code FROM outbound_orders UNION SELECT warehouse_code FROM stock) codes;
INSERT INTO master_customers(code,name,active,created_at,updated_at)
SELECT CONCAT('AUTO-',LEFT(HEX(SHA2(customer_name,256)),24)),customer_name,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)
FROM outbound_orders GROUP BY customer_name;

ALTER TABLE outbound_orders ADD COLUMN customer_code VARCHAR(80) NULL;
UPDATE outbound_orders SET customer_code=CONCAT('AUTO-',LEFT(HEX(SHA2(customer_name,256)),24));
ALTER TABLE outbound_orders
  ADD CONSTRAINT outbound_customer_fk FOREIGN KEY(customer_code) REFERENCES master_customers(code) ON DELETE RESTRICT,
  ADD CONSTRAINT outbound_warehouse_fk FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT;
ALTER TABLE outbound_lines
  ADD CONSTRAINT outbound_product_fk FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT;
ALTER TABLE stock
  ADD CONSTRAINT stock_product_fk FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_warehouse_fk FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT;
ALTER TABLE scan_catalog
  ADD CONSTRAINT catalog_product_fk FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT;

CREATE TABLE inbound_receipts (
  id VARCHAR(80) PRIMARY KEY, receipt_no VARCHAR(100) NOT NULL UNIQUE,
  supplier_code VARCHAR(80) NOT NULL, warehouse_code VARCHAR(80) NOT NULL,
  memo VARCHAR(500) NULL, created_by VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL,
  INDEX inbound_created(created_at DESC,id DESC),
  FOREIGN KEY(supplier_code) REFERENCES master_suppliers(code) ON DELETE RESTRICT,
  FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT,
  FOREIGN KEY(created_by) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE inbound_lines (
  id VARCHAR(80) PRIMARY KEY, receipt_id VARCHAR(80) NOT NULL,
  product_code VARCHAR(80) NOT NULL, packages INT NOT NULL CHECK(packages > 0),
  weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes > 0),
  UNIQUE KEY inbound_receipt_product(receipt_id,product_code),
  FOREIGN KEY(receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
  FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
ALTER TABLE stock_journal
  MODIFY order_id VARCHAR(80) NULL,
  ADD COLUMN inbound_receipt_id VARCHAR(80) NULL,
  ADD CONSTRAINT stock_journal_inbound_fk FOREIGN KEY(inbound_receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
  ADD UNIQUE KEY journal_inbound_product(inbound_receipt_id,product_code),
  ADD CONSTRAINT stock_journal_source_chk CHECK((order_id IS NULL AND inbound_receipt_id IS NOT NULL) OR
    (order_id IS NOT NULL AND inbound_receipt_id IS NULL));
