CREATE TABLE master_code_counters (
  prefix VARCHAR(8) PRIMARY KEY,
  `last_value` INT NOT NULL
) ENGINE=InnoDB;

ALTER TABLE master_customers ADD COLUMN legacy_code VARCHAR(80) NULL;
ALTER TABLE master_suppliers ADD COLUMN legacy_code VARCHAR(80) NULL;
ALTER TABLE master_warehouses ADD COLUMN legacy_code VARCHAR(80) NULL;
UPDATE master_customers SET legacy_code=code;
UPDATE master_suppliers SET legacy_code=code;
UPDATE master_warehouses SET legacy_code=code;

INSERT INTO master_code_counters(prefix,`last_value`)
SELECT 'C',MAX(CAST(SUBSTRING(code,2) AS UNSIGNED)) FROM master_customers
WHERE code REGEXP '^C[0-9]{5}$' HAVING MAX(CAST(SUBSTRING(code,2) AS UNSIGNED))>0;
INSERT INTO master_code_counters(prefix,`last_value`)
SELECT 'S',MAX(CAST(SUBSTRING(code,2) AS UNSIGNED)) FROM master_suppliers
WHERE code REGEXP '^S[0-9]{4}$' HAVING MAX(CAST(SUBSTRING(code,2) AS UNSIGNED))>0;
INSERT INTO master_code_counters(prefix,`last_value`)
SELECT 'W',MAX(CAST(SUBSTRING(code,2) AS UNSIGNED)) FROM master_warehouses
WHERE code REGEXP '^W[0-9]{2}$' HAVING MAX(CAST(SUBSTRING(code,2) AS UNSIGNED))>0;

ALTER TABLE document_number_rules ALTER COLUMN sequence_width SET DEFAULT 3;
UPDATE document_number_rules SET sequence_width=3,version=version+1 WHERE sequence_width<>3;
