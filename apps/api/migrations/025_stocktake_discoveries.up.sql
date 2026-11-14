CREATE TABLE stocktake_discovery_lines (
 id CHAR(36) PRIMARY KEY, stocktake_id CHAR(36) NOT NULL,
 warehouse_code VARCHAR(80) NOT NULL, product_code VARCHAR(80) NOT NULL,
 packages INT NOT NULL CHECK(packages>=0),
 weight_grams BIGINT NOT NULL CHECK(weight_grams>=0 AND weight_grams<=99999999999900 AND MOD(weight_grams,100)=0),
 reason VARCHAR(500) NOT NULL CHECK(CHAR_LENGTH(TRIM(reason))>0),
 actor VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 0,
 UNIQUE KEY stocktake_discovery_product(stocktake_id,product_code),
 FOREIGN KEY(stocktake_id) REFERENCES stocktakes(id) ON DELETE RESTRICT,
 FOREIGN KEY(warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT,
 FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT,
 FOREIGN KEY(actor) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
-- DISCOVERY_TRIGGER
CREATE TRIGGER stocktake_discovery_insert BEFORE INSERT ON stocktake_discovery_lines FOR EACH ROW
BEGIN
 IF NOT EXISTS(SELECT 1 FROM stocktakes WHERE id=NEW.stocktake_id AND status='counting' AND warehouse_code=NEW.warehouse_code)
 OR EXISTS(SELECT 1 FROM stocktake_snapshots WHERE stocktake_id=NEW.stocktake_id AND product_code=NEW.product_code) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Discovery requires counting stocktake, matching warehouse and no snapshot';
 END IF;
END;
-- DISCOVERY_TRIGGER
CREATE TRIGGER stocktake_discovery_update BEFORE UPDATE ON stocktake_discovery_lines FOR EACH ROW
BEGIN
 IF NOT EXISTS(SELECT 1 FROM stocktakes WHERE id=OLD.stocktake_id AND status='counting')
 OR NEW.id<>OLD.id OR NEW.stocktake_id<>OLD.stocktake_id OR NEW.warehouse_code<>OLD.warehouse_code
 OR NEW.product_code<>OLD.product_code OR NEW.actor<>OLD.actor OR NEW.created_at<>OLD.created_at
 OR NEW.version<>OLD.version+1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Discovery is closed or immutable identity/version changed';
 END IF;
END;
-- DISCOVERY_TRIGGER
CREATE TRIGGER stocktake_discovery_delete BEFORE DELETE ON stocktake_discovery_lines FOR EACH ROW
BEGIN
 IF NOT EXISTS(SELECT 1 FROM stocktakes WHERE id=OLD.stocktake_id AND status='counting') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Closed stocktake discoveries are immutable';
 END IF;
END;
