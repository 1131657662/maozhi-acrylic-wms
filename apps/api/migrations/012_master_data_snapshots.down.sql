ALTER TABLE outbound_lines DROP COLUMN product_model_snapshot, DROP COLUMN package_type_snapshot;
ALTER TABLE inbound_lines DROP COLUMN product_name_snapshot, DROP COLUMN product_model_snapshot, DROP COLUMN package_type_snapshot;
ALTER TABLE outbound_orders DROP FOREIGN KEY outbound_contact_fk, DROP FOREIGN KEY outbound_vehicle_fk,
 DROP COLUMN warehouse_name_snapshot, DROP COLUMN contact_id, DROP COLUMN vehicle_id,
 DROP COLUMN ship_to_name, DROP COLUMN ship_to_phone, DROP COLUMN ship_to_address,
 DROP COLUMN snapshot_origin, DROP COLUMN snapshot_captured_at;
ALTER TABLE inbound_receipts DROP FOREIGN KEY inbound_contact_fk,
 DROP COLUMN supplier_name_snapshot, DROP COLUMN warehouse_name_snapshot, DROP COLUMN contact_id,
 DROP COLUMN delivery_name, DROP COLUMN delivery_phone, DROP COLUMN delivery_address,
 DROP COLUMN snapshot_origin, DROP COLUMN snapshot_captured_at;
DROP TABLE vehicle_document_uses;
DROP TABLE master_vehicles;
DROP TABLE party_contact_defaults;
DROP TABLE party_contacts;
DROP TABLE product_eligibility_migration;
ALTER TABLE master_suppliers DROP COLUMN memo;
ALTER TABLE master_customers DROP COLUMN memo;
ALTER TABLE master_warehouses DROP COLUMN contact, DROP COLUMN phone, DROP COLUMN address, DROP COLUMN memo;
ALTER TABLE master_products DROP FOREIGN KEY product_category_fk,
 DROP INDEX product_inventory_lookup,
 DROP CHECK product_alert_range, DROP CHECK product_catalog_ineligible,
 DROP COLUMN origin_kind, DROP COLUMN inventory_eligible, DROP COLUMN model, DROP COLUMN category_code,
 DROP COLUMN package_type, DROP COLUMN package_color, DROP COLUMN strap_color,
 DROP COLUMN min_alert_tonnes, DROP COLUMN max_alert_tonnes, DROP COLUMN memo;
DROP TABLE master_product_categories;
