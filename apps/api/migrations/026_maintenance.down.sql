-- migrateDown checks ALL three tables before any DDL or migration-state mutation.
DROP TABLE backup_artifacts;
DROP TABLE scheduler_runs;
DROP TABLE maintenance_jobs;
