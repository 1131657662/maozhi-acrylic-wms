-- migrateDown refuses this operation while any memo is non-NULL.
ALTER TABLE outbound_orders DROP COLUMN memo;
