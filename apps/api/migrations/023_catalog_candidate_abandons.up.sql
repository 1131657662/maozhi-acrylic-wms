CREATE TABLE catalog_candidate_abandons (
 -- 类型与符号必须与 catalog_versions.version_id 完全一致，改父表类型前先评估所有引用表。
 version_id INT NOT NULL PRIMARY KEY CHECK(version_id > 0),
 reason VARCHAR(500) NOT NULL CHECK(CHAR_LENGTH(TRIM(reason)) > 0),
 actor VARCHAR(80) NOT NULL,
 operation_id CHAR(36) NOT NULL UNIQUE,
 created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(version_id) REFERENCES catalog_versions(version_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TRIGGER catalog_candidate_abandons_no_update BEFORE UPDATE ON catalog_candidate_abandons
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Candidate abandonment records are immutable';
CREATE TRIGGER catalog_candidate_abandons_no_delete BEFORE DELETE ON catalog_candidate_abandons
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Candidate abandonment records are immutable';
