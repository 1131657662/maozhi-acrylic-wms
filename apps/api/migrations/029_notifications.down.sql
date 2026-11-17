-- migrateDown guards both tables before any DDL or migration state change.
DROP TABLE notification_scan_state;
DROP TABLE notifications;
