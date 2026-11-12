ALTER TABLE scan_facts
  ADD COLUMN source VARCHAR(16) NULL,
  ADD COLUMN attribution VARCHAR(16) NULL,
  ADD COLUMN revoked_at DATETIME(3) NULL,
  ADD COLUMN revoked_by VARCHAR(80) NULL,
  ADD CONSTRAINT scan_source_valid CHECK(source IS NULL OR source IN ('scanner','search','paste','manual')),
  ADD CONSTRAINT scan_attribution_valid CHECK(attribution IS NULL OR attribution IN ('catalog','manual')),
  ADD UNIQUE KEY fact_order_barcode(plan_id,barcode),
  DROP INDEX fact_barcode;
