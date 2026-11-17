ALTER TABLE backup_artifacts ADD COLUMN baseline JSON NULL;

CREATE TABLE restore_verifications (
  job_id CHAR(36) PRIMARY KEY,
  artifact_id CHAR(36) NOT NULL,
  prebackup_id CHAR(36) NULL,
  database_name VARCHAR(64) NULL UNIQUE,
  account_name VARCHAR(32) NULL UNIQUE,
  database_created BOOLEAN NOT NULL DEFAULT FALSE,
  account_created BOOLEAN NOT NULL DEFAULT FALSE,
  account_locked BOOLEAN NOT NULL DEFAULT FALSE,
  stage VARCHAR(16) NOT NULL CHECK (stage IN ('backup','provision','import','verify','report')),
  report JSON NULL,
  actual_baseline JSON NULL,
  evidence JSON NOT NULL,
  CONSTRAINT restore_job FOREIGN KEY (job_id) REFERENCES maintenance_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT restore_artifact FOREIGN KEY (artifact_id) REFERENCES backup_artifacts(id) ON DELETE RESTRICT,
  CONSTRAINT restore_prebackup FOREIGN KEY (prebackup_id) REFERENCES backup_artifacts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
