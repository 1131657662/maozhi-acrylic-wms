-- The migration runner checks all extension data before executing any DDL.
ALTER TABLE sessions DROP INDEX sessions_public_id,
  DROP COLUMN id, DROP COLUMN created_at, DROP COLUMN epoch;
ALTER TABLE owner DROP COLUMN display_name, DROP COLUMN password_changed_at,
  DROP COLUMN auth_epoch, DROP COLUMN failed_attempts, DROP COLUMN locked_until;
