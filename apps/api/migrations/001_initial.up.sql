CREATE TABLE app_meta (
  meta_key VARCHAR(64) PRIMARY KEY, value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE owner (
  username VARCHAR(80) PRIMARY KEY, password_hash VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY, username VARCHAR(80) NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK(channel IN ('web','pda','miniapp')),
  expires_at BIGINT NOT NULL,
  FOREIGN KEY(username) REFERENCES owner(username) ON DELETE RESTRICT,
  INDEX sessions_expiry(expires_at)
) ENGINE=InnoDB;
CREATE TABLE outbound_orders (
  id VARCHAR(80) PRIMARY KEY, order_no VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(200) NOT NULL, warehouse_code VARCHAR(80) NOT NULL,
  vehicle_no VARCHAR(100) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'open',
  revision INT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL,
  CHECK(status IN ('open','frozen','confirmed')),
  INDEX outbound_status_created(status,created_at DESC,id DESC),
  INDEX outbound_created(created_at DESC,id DESC)
) ENGINE=InnoDB;
CREATE TABLE outbound_lines (
  id VARCHAR(80) PRIMARY KEY, order_id VARCHAR(80) NOT NULL,
  product_code VARCHAR(80) NOT NULL, product_name VARCHAR(200) NOT NULL,
  planned_packages INT NOT NULL CHECK(planned_packages > 0),
  planned_weight_tonnes DECIMAL(12,4) NOT NULL CHECK(planned_weight_tonnes > 0),
  FOREIGN KEY(order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
  UNIQUE KEY line_order_product(order_id,product_code)
) ENGINE=InnoDB;
CREATE TABLE stock (
  warehouse_code VARCHAR(80) NOT NULL, product_code VARCHAR(80) NOT NULL,
  packages INT NOT NULL CHECK(packages >= 0),
  weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes >= 0),
  PRIMARY KEY(warehouse_code,product_code)
) ENGINE=InnoDB;
CREATE TABLE scan_catalog (
  barcode VARCHAR(80) PRIMARY KEY, product_code VARCHAR(80) NOT NULL,
  weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes > 0),
  catalog_version INT NOT NULL CHECK(catalog_version = 1)
) ENGINE=InnoDB;
CREATE TABLE scan_facts (
  id CHAR(36) PRIMARY KEY, plan_id VARCHAR(80) NOT NULL, barcode VARCHAR(80) NOT NULL,
  weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes > 0),
  catalog_version INT NOT NULL CHECK(catalog_version = 1),
  weight_source VARCHAR(16) NOT NULL CHECK(weight_source = 'catalog'),
  device_id VARCHAR(80) NOT NULL, scanned_at DATETIME(3) NOT NULL, received_at DATETIME(3) NOT NULL,
  recorded_by VARCHAR(80) NOT NULL, payload_hash CHAR(64) NOT NULL,
  UNIQUE KEY fact_barcode(barcode), INDEX facts_plan(plan_id,id),
  FOREIGN KEY(plan_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY(barcode) REFERENCES scan_catalog(barcode) ON DELETE RESTRICT,
  FOREIGN KEY(recorded_by) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE scan_submissions (
  plan_id VARCHAR(80) PRIMARY KEY, digest CHAR(64) NOT NULL,
  revision INT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL,
  FOREIGN KEY(plan_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE stock_journal (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(80) NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL, product_code VARCHAR(80) NOT NULL,
  packages_delta INT NOT NULL, tonnes_delta DECIMAL(12,4) NOT NULL, created_at DATETIME(3) NOT NULL,
  UNIQUE KEY journal_order_product(order_id,product_code),
  FOREIGN KEY(order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE operation_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, action VARCHAR(80) NOT NULL,
  target_id VARCHAR(100) NOT NULL, actor VARCHAR(80) NOT NULL, trace_id VARCHAR(80) NOT NULL,
  before_json LONGTEXT NOT NULL CHECK(JSON_VALID(before_json)),
  after_json LONGTEXT NOT NULL CHECK(JSON_VALID(after_json)), created_at DATETIME(3) NOT NULL,
  INDEX operation_target(target_id,id)
) ENGINE=InnoDB;
CREATE TABLE idempotent_commands (
  command_key VARCHAR(255) PRIMARY KEY, payload_hash CHAR(64) NOT NULL,
  result_json LONGTEXT NOT NULL CHECK(JSON_VALID(result_json))
) ENGINE=InnoDB;
