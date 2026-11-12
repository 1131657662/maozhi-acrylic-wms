ALTER TABLE outbound_orders
  ADD COLUMN short_closed_at DATETIME(3) NULL,
  ADD COLUMN short_close_reason VARCHAR(500) NULL,
  ADD COLUMN short_closed_packages INT UNSIGNED NULL,
  ADD COLUMN short_closed_grams BIGINT UNSIGNED NULL;
