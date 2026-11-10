-- The runner checks all affected tables are empty before any DDL.
ALTER TABLE master_customers DROP COLUMN legacy_code;
ALTER TABLE master_suppliers DROP COLUMN legacy_code;
ALTER TABLE master_warehouses DROP COLUMN legacy_code;
ALTER TABLE document_number_rules ALTER COLUMN sequence_width DROP DEFAULT;
DROP TABLE master_code_counters;
