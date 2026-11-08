ALTER TABLE inventory_operations DROP CHECK inventory_operation_type,
 ADD CONSTRAINT inventory_operation_type CHECK (operation_type IN
 ('inbound.confirm','outbound.confirm','stock.adjust','inbound.reverse','outbound.reverse','stocktake.post'));
CREATE TABLE stocktakes (
 id CHAR(36) PRIMARY KEY, number VARCHAR(80) NOT NULL UNIQUE,
 warehouse_code VARCHAR(80) NOT NULL, scope_kind VARCHAR(16) NOT NULL CHECK(scope_kind IN ('warehouse','products')),
 status VARCHAR(16) NOT NULL CHECK(status IN ('counting','completed','voided')),
 snapshot_at DATETIME(3) NOT NULL, journal_watermark BIGINT UNSIGNED NOT NULL,
 snapshot_hash CHAR(64) NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 0,
 line_count INT UNSIGNED NOT NULL, created_by VARCHAR(80) NOT NULL,
 closed_at DATETIME(3) NULL, close_reason VARCHAR(500) NULL, operation_id CHAR(36) NULL UNIQUE,
 FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT,
 FOREIGN KEY(created_by) REFERENCES owner(username) ON DELETE RESTRICT,
 FOREIGN KEY(operation_id) REFERENCES inventory_operations(id) ON DELETE RESTRICT,
 INDEX stocktake_status_time(status,snapshot_at,id),
 INDEX stocktake_warehouse_time(warehouse_code,snapshot_at,id)
) ENGINE=InnoDB;
CREATE TABLE stocktake_snapshots (
 stocktake_id CHAR(36) NOT NULL, product_code VARCHAR(80) NOT NULL, product_name VARCHAR(200) NOT NULL,
 packages INT NOT NULL CHECK(packages>=0), weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes>=0),
 PRIMARY KEY(stocktake_id,product_code),
 FOREIGN KEY(stocktake_id) REFERENCES stocktakes(id) ON DELETE RESTRICT,
 FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE stocktake_readings (
 stocktake_id CHAR(36) NOT NULL, product_code VARCHAR(80) NOT NULL,
 packages INT NULL CHECK(packages>=0), weight_tonnes DECIMAL(12,4) NULL CHECK(weight_tonnes>=0),
 revision INT UNSIGNED NOT NULL DEFAULT 0, updated_by VARCHAR(80) NULL, updated_at DATETIME(3) NULL,
 PRIMARY KEY(stocktake_id,product_code),
 CHECK((packages IS NULL)=(weight_tonnes IS NULL)),
 FOREIGN KEY(stocktake_id,product_code) REFERENCES stocktake_snapshots(stocktake_id,product_code) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE stocktake_windows (
 stocktake_id CHAR(36) PRIMARY KEY, warehouse_code VARCHAR(80) NOT NULL,
 started_at DATETIME(3) NOT NULL, released_at DATETIME(3) NULL,
 active_warehouse VARCHAR(80) GENERATED ALWAYS AS (IF(released_at IS NULL,warehouse_code,NULL)) STORED,
 UNIQUE KEY stocktake_active_warehouse(active_warehouse),
 FOREIGN KEY(stocktake_id) REFERENCES stocktakes(id) ON DELETE RESTRICT,
 FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TRIGGER stocktake_snapshot_no_update BEFORE UPDATE ON stocktake_snapshots FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Stocktake snapshots are immutable';
CREATE TRIGGER stocktake_snapshot_no_delete BEFORE DELETE ON stocktake_snapshots FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Stocktake snapshots are immutable';
CREATE INDEX inbound_warehouse_time ON inbound_receipts(warehouse_code,created_at,id);
CREATE INDEX outbound_warehouse_status ON outbound_orders(warehouse_code,status,id);
