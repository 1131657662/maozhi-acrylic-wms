CREATE TABLE document_number_rules (
  kind VARCHAR(16) PRIMARY KEY,
  sequence_width TINYINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT chk_number_kind CHECK (kind IN ('inbound','outbound')),
  CONSTRAINT chk_number_width CHECK (sequence_width BETWEEN 2 AND 8)
) ENGINE=InnoDB;

CREATE TABLE document_number_counters (
  kind VARCHAR(16) NOT NULL,
  date_key CHAR(8) NOT NULL,
  last_sequence BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (kind,date_key),
  CONSTRAINT fk_number_rule FOREIGN KEY (kind) REFERENCES document_number_rules(kind)
) ENGINE=InnoDB;
