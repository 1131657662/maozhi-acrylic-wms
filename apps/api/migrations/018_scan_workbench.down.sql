ALTER TABLE scan_facts
  ADD UNIQUE KEY fact_barcode(barcode),
  DROP INDEX fact_order_barcode,
  DROP CHECK scan_source_valid,
  DROP CHECK scan_attribution_valid,
  DROP COLUMN source,
  DROP COLUMN attribution,
  DROP COLUMN revoked_at,
  DROP COLUMN revoked_by;
