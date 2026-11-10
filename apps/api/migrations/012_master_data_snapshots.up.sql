CREATE TABLE master_product_categories (
 code VARCHAR(80) PRIMARY KEY, name VARCHAR(200) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 source_del_flag BOOLEAN NOT NULL DEFAULT FALSE, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 CHECK(active IN (0,1)), CHECK(source_del_flag IN (0,1))
) ENGINE=InnoDB;
ALTER TABLE master_products
 ADD COLUMN origin_kind VARCHAR(16) NOT NULL DEFAULT 'unknown' CHECK(origin_kind IN ('local','legacy','unknown')),
 ADD COLUMN inventory_eligible BOOLEAN NOT NULL DEFAULT FALSE CHECK(inventory_eligible IN (0,1)),
 ADD COLUMN model VARCHAR(200) NULL,
 ADD COLUMN category_code VARCHAR(80) NULL,
 ADD COLUMN package_type VARCHAR(100) NULL,
 ADD COLUMN package_color VARCHAR(100) NULL,
 ADD COLUMN strap_color VARCHAR(100) NULL,
 ADD COLUMN min_alert_tonnes DECIMAL(12,4) NULL CHECK(min_alert_tonnes>=0),
 ADD COLUMN max_alert_tonnes DECIMAL(12,4) NULL CHECK(max_alert_tonnes>=0),
 ADD COLUMN memo VARCHAR(500) NULL,
 ADD CONSTRAINT product_category_fk FOREIGN KEY(category_code) REFERENCES master_product_categories(code) ON DELETE RESTRICT,
 ADD CONSTRAINT product_alert_range CHECK(min_alert_tonnes IS NULL OR max_alert_tonnes IS NULL OR min_alert_tonnes<=max_alert_tonnes),
 ADD CONSTRAINT product_catalog_ineligible CHECK(source_kind<>'sku-spec' OR inventory_eligible=0),
 ADD INDEX product_inventory_lookup(inventory_eligible,source_del_flag,active,code);
ALTER TABLE master_warehouses ADD COLUMN contact VARCHAR(100) NULL, ADD COLUMN phone VARCHAR(50) NULL,
 ADD COLUMN address VARCHAR(500) NULL, ADD COLUMN memo VARCHAR(500) NULL;
ALTER TABLE master_customers ADD COLUMN memo VARCHAR(500) NULL;
ALTER TABLE master_suppliers ADD COLUMN memo VARCHAR(500) NULL;
CREATE TABLE product_eligibility_migration (
 product_code VARCHAR(80) PRIMARY KEY, source_kind VARCHAR(16) NOT NULL, origin_kind VARCHAR(16) NOT NULL,
 inventory_eligible BOOLEAN NOT NULL, reason VARCHAR(500) NOT NULL, evidence_json JSON NOT NULL,
 FOREIGN KEY(product_code) REFERENCES master_products(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE party_contacts (
 id CHAR(36) PRIMARY KEY, party_type VARCHAR(16) NOT NULL CHECK(party_type IN ('customer','supplier')),
 customer_code VARCHAR(80) NULL, supplier_code VARCHAR(80) NULL,
 owner_code VARCHAR(80) GENERATED ALWAYS AS(COALESCE(customer_code,supplier_code)) STORED,
 name VARCHAR(100) NOT NULL, phone VARCHAR(50) NULL, address VARCHAR(500) NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE CHECK(active IN (0,1)),
 created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 CONSTRAINT contact_owner CHECK((party_type='customer' AND customer_code IS NOT NULL AND supplier_code IS NULL)
  OR (party_type='supplier' AND supplier_code IS NOT NULL AND customer_code IS NULL)),
 FOREIGN KEY(customer_code) REFERENCES master_customers(code) ON DELETE RESTRICT,
 FOREIGN KEY(supplier_code) REFERENCES master_suppliers(code) ON DELETE RESTRICT,
 UNIQUE KEY contact_owner_key(id,party_type,owner_code), INDEX contact_owner_list(party_type,owner_code,active,id)
) ENGINE=InnoDB;
CREATE TABLE party_contact_defaults (
 party_type VARCHAR(16) NOT NULL, party_code VARCHAR(80) NOT NULL, contact_id CHAR(36) NOT NULL,
 PRIMARY KEY(party_type,party_code),
 FOREIGN KEY(contact_id,party_type,party_code) REFERENCES party_contacts(id,party_type,owner_code) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE master_vehicles (
 id CHAR(36) PRIMARY KEY, plate_original VARCHAR(100) NOT NULL, plate_normalized VARCHAR(100) NOT NULL UNIQUE,
 driver VARCHAR(100) NULL, phone VARCHAR(50) NULL, active BOOLEAN NOT NULL DEFAULT TRUE CHECK(active IN (0,1)),
 source VARCHAR(16) NOT NULL CHECK(source IN ('manual','auto')), memo VARCHAR(500) NULL,
 use_count INT UNSIGNED NOT NULL DEFAULT 0, last_used_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE vehicle_document_uses (
 vehicle_id CHAR(36) NOT NULL, document_id VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(vehicle_id,document_id),
 FOREIGN KEY(vehicle_id) REFERENCES master_vehicles(id) ON DELETE RESTRICT,
 FOREIGN KEY(document_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
ALTER TABLE inbound_receipts ADD COLUMN supplier_name_snapshot VARCHAR(200) NULL,
 ADD COLUMN warehouse_name_snapshot VARCHAR(200) NULL, ADD COLUMN contact_id CHAR(36) NULL,
 ADD COLUMN delivery_name VARCHAR(100) NULL, ADD COLUMN delivery_phone VARCHAR(50) NULL, ADD COLUMN delivery_address VARCHAR(500) NULL,
 ADD COLUMN snapshot_origin VARCHAR(16) NULL, ADD COLUMN snapshot_captured_at DATETIME(3) NULL,
 ADD CONSTRAINT inbound_contact_fk FOREIGN KEY(contact_id) REFERENCES party_contacts(id) ON DELETE RESTRICT;
ALTER TABLE outbound_orders ADD COLUMN warehouse_name_snapshot VARCHAR(200) NULL,
 ADD COLUMN contact_id CHAR(36) NULL, ADD COLUMN vehicle_id CHAR(36) NULL,
 ADD COLUMN ship_to_name VARCHAR(100) NULL, ADD COLUMN ship_to_phone VARCHAR(50) NULL, ADD COLUMN ship_to_address VARCHAR(500) NULL,
 ADD COLUMN snapshot_origin VARCHAR(16) NULL, ADD COLUMN snapshot_captured_at DATETIME(3) NULL,
 ADD CONSTRAINT outbound_contact_fk FOREIGN KEY(contact_id) REFERENCES party_contacts(id) ON DELETE RESTRICT,
 ADD CONSTRAINT outbound_vehicle_fk FOREIGN KEY(vehicle_id) REFERENCES master_vehicles(id) ON DELETE RESTRICT;
ALTER TABLE inbound_lines ADD COLUMN product_name_snapshot VARCHAR(200) NULL,
 ADD COLUMN product_model_snapshot VARCHAR(200) NULL, ADD COLUMN package_type_snapshot VARCHAR(100) NULL;
ALTER TABLE outbound_lines ADD COLUMN product_model_snapshot VARCHAR(200) NULL, ADD COLUMN package_type_snapshot VARCHAR(100) NULL;
