-- migrateDown checks user_list_preferences is empty under the migration lock before any DDL.
DROP TABLE user_list_preferences;
