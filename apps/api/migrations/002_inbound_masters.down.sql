DROP TABLE inbound_lines;
ALTER TABLE stock_journal
  DROP CHECK stock_journal_source_chk,
  DROP FOREIGN KEY stock_journal_inbound_fk,
  DROP INDEX journal_inbound_product,
  DROP COLUMN inbound_receipt_id,
  MODIFY order_id VARCHAR(80) NOT NULL;
DROP TABLE inbound_receipts;
ALTER TABLE scan_catalog DROP FOREIGN KEY catalog_product_fk;
ALTER TABLE stock DROP FOREIGN KEY stock_warehouse_fk, DROP FOREIGN KEY stock_product_fk;
ALTER TABLE outbound_lines DROP FOREIGN KEY outbound_product_fk;
ALTER TABLE outbound_orders DROP FOREIGN KEY outbound_warehouse_fk, DROP FOREIGN KEY outbound_customer_fk, DROP COLUMN customer_code;
DROP TABLE master_suppliers;
DROP TABLE master_customers;
DROP TABLE master_warehouses;
DROP TABLE master_products;
