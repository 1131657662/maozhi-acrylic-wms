CREATE TABLE document_date_corrections (
 id CHAR(36) PRIMARY KEY,
 document_kind VARCHAR(16) NOT NULL CHECK(document_kind IN ('inbound','outbound')),
 document_id VARCHAR(80) NOT NULL,
 previous_correction_id CHAR(36) NULL,
 before_date DATE NOT NULL,
 after_date DATE NOT NULL,
 reason VARCHAR(500) NOT NULL CHECK(CHAR_LENGTH(TRIM(reason))>0),
 actor VARCHAR(80) NOT NULL,
 operation_id CHAR(36) NOT NULL UNIQUE,
 created_at DATETIME(3) NOT NULL,
 revision INT UNSIGNED NOT NULL CHECK(revision>0),
 UNIQUE KEY date_correction_version(document_kind,document_id,revision),
 KEY date_correction_history(document_kind,document_id,created_at),
 FOREIGN KEY(previous_correction_id) REFERENCES document_date_corrections(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor) REFERENCES owner(username) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TRIGGER document_date_corrections_no_update BEFORE UPDATE ON document_date_corrections
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Date correction records are immutable';
CREATE TRIGGER document_date_corrections_no_delete BEFORE DELETE ON document_date_corrections
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Date correction records are immutable';
