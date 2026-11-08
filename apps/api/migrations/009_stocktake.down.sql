DROP INDEX outbound_warehouse_status ON outbound_orders;
DROP INDEX inbound_warehouse_time ON inbound_receipts;
DROP TRIGGER stocktake_snapshot_no_delete;
DROP TRIGGER stocktake_snapshot_no_update;
DROP TABLE stocktake_windows;
DROP TABLE stocktake_readings;
DROP TABLE stocktake_snapshots;
DROP TABLE stocktakes;
ALTER TABLE inventory_operations DROP CHECK inventory_operation_type,
 ADD CONSTRAINT inventory_operation_type CHECK (operation_type IN
 ('inbound.confirm','outbound.confirm','stock.adjust','inbound.reverse','outbound.reverse'));
