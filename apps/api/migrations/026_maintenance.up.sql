CREATE TABLE maintenance_jobs (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('backup','restore')),
  status VARCHAR(16) NOT NULL CHECK (status IN ('queued','running','succeeded','failed','interrupted')),
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  operator VARCHAR(80) NOT NULL,
  params JSON NOT NULL,
  result JSON NULL,
  error VARCHAR(500) NULL,
  operation_id CHAR(36) NOT NULL,
  CONSTRAINT maintenance_operator FOREIGN KEY (operator) REFERENCES owner(username) ON DELETE RESTRICT,
  CONSTRAINT maintenance_finished CHECK (finished_at IS NULL OR finished_at >= started_at),
  UNIQUE KEY maintenance_operation (operator,operation_id),
  INDEX maintenance_time (started_at DESC,id DESC),
  INDEX maintenance_kind_time (kind,started_at DESC,id DESC),
  INDEX maintenance_status (status,id)
) ENGINE=InnoDB;

CREATE TABLE backup_artifacts (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  path VARCHAR(255) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL CHECK (bytes > 0),
  sha256 CHAR(64) NOT NULL CHECK (sha256 REGEXP '^[0-9a-f]{64}$'),
  created_at DATETIME(3) NOT NULL,
  retention_class VARCHAR(16) NOT NULL CHECK (retention_class IN ('daily','monthly')),
  CONSTRAINT artifact_job FOREIGN KEY (job_id) REFERENCES maintenance_jobs(id) ON DELETE RESTRICT,
  UNIQUE KEY artifact_job_unique (job_id),
  UNIQUE KEY artifact_path (path),
  INDEX artifact_time (created_at DESC,id DESC)
) ENGINE=InnoDB;

CREATE TABLE scheduler_runs (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  ran_at DATETIME(3) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('running','succeeded','failed','interrupted')),
  detail JSON NOT NULL,
  INDEX scheduler_kind_time (kind,ran_at DESC,id DESC)
) ENGINE=InnoDB;
