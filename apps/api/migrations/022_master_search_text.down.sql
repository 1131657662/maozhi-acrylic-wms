-- Only through migrateDown: reject any non-NULL search_text in all four tables before any DDL.
ALTER TABLE master_vehicles DROP INDEX master_vehicles_search_text, DROP COLUMN search_text;
ALTER TABLE master_suppliers DROP INDEX master_suppliers_search_text, DROP COLUMN search_text;
ALTER TABLE master_customers DROP INDEX master_customers_search_text, DROP COLUMN search_text;
ALTER TABLE master_products DROP INDEX master_products_search_text, DROP COLUMN search_text;
