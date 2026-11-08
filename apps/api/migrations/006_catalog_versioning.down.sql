ALTER TABLE scan_facts DROP FOREIGN KEY scan_fact_version_entry_fk, DROP CHECK scan_fact_version_positive;
DROP VIEW scan_catalog;
DROP TRIGGER catalog_archive_no_insert;
DROP TRIGGER catalog_archive_no_update;
DROP TRIGGER catalog_archive_no_delete;
RENAME TABLE scan_catalog_v1_archive TO scan_catalog;
ALTER TABLE scan_facts ADD CONSTRAINT scan_facts_chk_2 CHECK(catalog_version=1),
  ADD CONSTRAINT scan_facts_ibfk_2 FOREIGN KEY(barcode) REFERENCES scan_catalog(barcode) ON DELETE RESTRICT;
DROP TABLE scan_fact_context;
DROP TABLE catalog_head;
DROP TABLE catalog_entries;
DROP TABLE catalog_client_activity;
DROP TABLE catalog_versions;
