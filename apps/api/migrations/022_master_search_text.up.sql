ALTER TABLE master_products ADD COLUMN search_text VARCHAR(512) NULL,
 ADD INDEX master_products_search_text(search_text);
ALTER TABLE master_customers ADD COLUMN search_text VARCHAR(512) NULL,
 ADD INDEX master_customers_search_text(search_text);
ALTER TABLE master_suppliers ADD COLUMN search_text VARCHAR(512) NULL,
 ADD INDEX master_suppliers_search_text(search_text);
ALTER TABLE master_vehicles ADD COLUMN search_text VARCHAR(512) NULL,
 ADD INDEX master_vehicles_search_text(search_text);
