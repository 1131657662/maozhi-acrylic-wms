CREATE TABLE user_list_preferences (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  list_kind VARCHAR(32) NOT NULL,
  schema_version INT NOT NULL,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_user_list (user_id, list_kind)
) ENGINE=InnoDB;
