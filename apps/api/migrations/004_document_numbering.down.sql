-- Run only through migrateDown: nonempty rules/counters refuse rollback.
DROP TABLE document_number_counters;
DROP TABLE document_number_rules;
