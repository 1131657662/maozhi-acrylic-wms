CREATE TABLE pda_handoffs (
  id CHAR(36) PRIMARY KEY, device_id VARCHAR(80) NOT NULL, app_version VARCHAR(80) NOT NULL,
  expected_count INT UNSIGNED NOT NULL, manifest_sha CHAR(64) NOT NULL,
  catalog_version INT NOT NULL, catalog_sha CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL, confirmed_at DATETIME(3) NULL,
  FOREIGN KEY(catalog_version) REFERENCES catalog_versions(version_id) ON DELETE RESTRICT,
  INDEX handoff_device(device_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE pda_handoff_records (
  handoff_id CHAR(36) NOT NULL, fact_id CHAR(36) NOT NULL, plan_id VARCHAR(80) NOT NULL,
  raw_payload LONGTEXT NOT NULL CHECK(JSON_VALID(raw_payload)), payload_sha CHAR(64) NOT NULL,
  body_hash CHAR(64) NOT NULL, local_state VARCHAR(20) NOT NULL,
  context_json LONGTEXT NULL CHECK(context_json IS NULL OR JSON_VALID(context_json)),
  PRIMARY KEY(handoff_id,fact_id),
  FOREIGN KEY(handoff_id) REFERENCES pda_handoffs(id) ON DELETE RESTRICT,
  FOREIGN KEY(plan_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE pda_handoff_clients (
  handoff_id CHAR(36) NOT NULL, client_key VARCHAR(100) NOT NULL,
  observed_requests INT UNSIGNED NOT NULL, observed_seen_at DATETIME(3) NOT NULL,
  PRIMARY KEY(handoff_id,client_key),
  FOREIGN KEY(handoff_id) REFERENCES pda_handoffs(id) ON DELETE RESTRICT,
  FOREIGN KEY(client_key) REFERENCES catalog_client_activity(client_key) ON DELETE RESTRICT
) ENGINE=InnoDB;
