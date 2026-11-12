ALTER TABLE outbound_orders
  DROP COLUMN short_closed_at,
  DROP COLUMN short_close_reason,
  DROP COLUMN short_closed_packages,
  DROP COLUMN short_closed_grams;
