CREATE TABLE catalog_versions (
  version_id INT AUTO_INCREMENT PRIMARY KEY, upload_uuid CHAR(36) NOT NULL UNIQUE,
  base_version_id INT NULL, base_revision INT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL CHECK(status IN ('staging','validated','published')),
  source_kind VARCHAR(32) NOT NULL, source_name VARCHAR(255) NOT NULL, source_encoding VARCHAR(16) NOT NULL,
  source_sha256 CHAR(64) NOT NULL, content_sha256 CHAR(64) NOT NULL, parser_version VARCHAR(32) NOT NULL,
  source_bytes MEDIUMBLOB NOT NULL, entry_count INT UNSIGNED NOT NULL, spec_count INT UNSIGNED NOT NULL,
  diff_json LONGTEXT NOT NULL CHECK(JSON_VALID(diff_json)), actor VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL, published_at DATETIME(3) NULL,
  FOREIGN KEY(base_version_id) REFERENCES catalog_versions(version_id) ON DELETE RESTRICT,
  INDEX catalog_content(content_sha256,version_id)
) ENGINE=InnoDB;
CREATE TABLE catalog_entries (
  version_id INT NOT NULL, barcode VARCHAR(80) NOT NULL, source_spec VARCHAR(255) NULL,
  raw_weight_kg VARCHAR(64) NOT NULL, weight_tonnes DECIMAL(12,4) NOT NULL CHECK(weight_tonnes>0),
  legacy_product_code VARCHAR(80) NULL, PRIMARY KEY(version_id,barcode),
  FOREIGN KEY(version_id) REFERENCES catalog_versions(version_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE catalog_head (
  id TINYINT PRIMARY KEY CHECK(id=1), active_version_id INT NOT NULL, revision INT UNSIGNED NOT NULL,
  FOREIGN KEY(active_version_id) REFERENCES catalog_versions(version_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE scan_fact_context (
  fact_id CHAR(36) PRIMARY KEY, catalog_version_id INT NOT NULL, barcode VARCHAR(80) NOT NULL,
  outbound_line_id VARCHAR(80) NOT NULL, erp_product_code VARCHAR(80) NOT NULL,
  source_spec VARCHAR(255) NULL, weight_tonnes DECIMAL(12,4) NOT NULL,
  resolved_at DATETIME(3) NULL, binding_source VARCHAR(32) NOT NULL, context_hash CHAR(64) NOT NULL,
  FOREIGN KEY(fact_id) REFERENCES scan_facts(id) ON DELETE RESTRICT,
  FOREIGN KEY(catalog_version_id,barcode) REFERENCES catalog_entries(version_id,barcode) ON DELETE RESTRICT,
  FOREIGN KEY(outbound_line_id) REFERENCES outbound_lines(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE catalog_client_activity (
  client_key VARCHAR(100) PRIMARY KEY, legacy_requests INT UNSIGNED NOT NULL DEFAULT 0,
  queue_verified TINYINT NOT NULL DEFAULT 0 CHECK(queue_verified IN (0,1)), last_seen_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
-- CATALOG_V1_FINALIZE
ALTER TABLE scan_facts DROP FOREIGN KEY scan_facts_ibfk_2, DROP CHECK scan_facts_chk_2,
  ADD CONSTRAINT scan_fact_version_positive CHECK(catalog_version>0),
  ADD CONSTRAINT scan_fact_version_entry_fk FOREIGN KEY(catalog_version,barcode)
  REFERENCES catalog_entries(version_id,barcode) ON DELETE RESTRICT;
RENAME TABLE scan_catalog TO scan_catalog_v1_archive;
CREATE TRIGGER catalog_archive_no_insert BEFORE INSERT ON scan_catalog_v1_archive FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SCAN_CATALOG_READ_ONLY';
CREATE TRIGGER catalog_archive_no_update BEFORE UPDATE ON scan_catalog_v1_archive FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SCAN_CATALOG_READ_ONLY';
CREATE TRIGGER catalog_archive_no_delete BEFORE DELETE ON scan_catalog_v1_archive FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SCAN_CATALOG_READ_ONLY';
CREATE ALGORITHM=TEMPTABLE VIEW scan_catalog AS SELECT barcode,legacy_product_code AS product_code,weight_tonnes,version_id AS catalog_version,source_spec FROM catalog_entries WHERE version_id=1;
