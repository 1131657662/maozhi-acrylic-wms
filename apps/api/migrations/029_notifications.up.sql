CREATE TABLE notifications (
 id CHAR(36) PRIMARY KEY,
 type VARCHAR(24) NOT NULL CHECK(type IN ('pending','shipment_overdue','stocktake_overdue','catalog_stale','backup_failed','anomaly')),
 object_type VARCHAR(24) NOT NULL CHECK(object_type IN ('inbound','outbound','stocktake','catalog','backup','schedule','stock')),
 object_id VARCHAR(200) NOT NULL,
 event_key CHAR(64) NOT NULL,
 cycle_anchor VARCHAR(100) NOT NULL,
 title VARCHAR(200) NOT NULL,
 body VARCHAR(500) NOT NULL,
 link_path VARCHAR(1000) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 read_at DATETIME(3) NULL,
 resolved_at DATETIME(3) NULL,
 expires_at DATETIME(3) NOT NULL,
 active_key CHAR(64) GENERATED ALWAYS AS (IF(resolved_at IS NULL,event_key,NULL)) STORED,
 UNIQUE KEY notification_active(active_key),
 INDEX notification_time(created_at DESC,id DESC),
 INDEX notification_type_time(type,created_at DESC,id DESC),
 INDEX notification_unread(read_at,resolved_at,created_at DESC,id DESC),
 INDEX notification_expiry(expires_at),
 CHECK(expires_at>created_at)
) ENGINE=InnoDB;
CREATE TABLE notification_scan_state (
 `key` VARCHAR(32) PRIMARY KEY,
 last_run_at DATETIME(3) NOT NULL,
 last_status VARCHAR(16) NOT NULL CHECK(last_status IN ('running','succeeded','failed','interrupted')),
 detail JSON NOT NULL
) ENGINE=InnoDB;
