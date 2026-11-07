ALTER TABLE scan_catalog DROP COLUMN source_spec;
ALTER TABLE stock_journal
  DROP INDEX journal_source_id,
  DROP COLUMN source_id,
  DROP CHECK stock_journal_chk_1,
  DROP COLUMN source_order_no,
  DROP COLUMN source_business_type,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
ALTER TABLE stock_journal
  ADD UNIQUE KEY journal_order_product(order_id,product_code),
  ADD UNIQUE KEY journal_inbound_product(inbound_receipt_id,product_code),
  ADD CONSTRAINT stock_journal_ibfk_1 FOREIGN KEY (order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_journal_inbound_fk FOREIGN KEY (inbound_receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_journal_source_chk CHECK ((order_id IS NULL AND inbound_receipt_id IS NOT NULL) OR
    (order_id IS NOT NULL AND inbound_receipt_id IS NULL));
ALTER TABLE stock
  DROP PRIMARY KEY,
  DROP INDEX stock_source_id,
  DROP CHECK stock_chk_3,
  DROP COLUMN source_id,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json,
  ADD PRIMARY KEY (warehouse_code,product_code);
ALTER TABLE stock
  ADD CONSTRAINT stock_product_fk FOREIGN KEY (product_code) REFERENCES master_products(code) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_warehouse_fk FOREIGN KEY (warehouse_code) REFERENCES master_warehouses(code) ON DELETE RESTRICT;
ALTER TABLE inbound_lines
  DROP INDEX inbound_line_receipt_id,
  DROP INDEX inbound_line_source_id,
  DROP CHECK inbound_lines_chk_3,
  DROP COLUMN source_id,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json,
  ADD UNIQUE KEY inbound_receipt_product(receipt_id,product_code);
ALTER TABLE inbound_lines
  ADD CONSTRAINT inbound_lines_ibfk_1 FOREIGN KEY (receipt_id) REFERENCES inbound_receipts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT inbound_lines_ibfk_2 FOREIGN KEY (product_code) REFERENCES master_products(code) ON DELETE RESTRICT;
ALTER TABLE inbound_receipts
  DROP INDEX inbound_source_id,
  DROP CHECK inbound_receipts_chk_1,
  DROP COLUMN status,
  DROP COLUMN source_id,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
ALTER TABLE outbound_lines
  DROP INDEX outbound_line_order_id,
  DROP INDEX outbound_line_source_id,
  DROP CHECK outbound_lines_chk_3,
  DROP COLUMN source_id,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json,
  ADD UNIQUE KEY line_order_product(order_id,product_code);
ALTER TABLE outbound_lines
  ADD CONSTRAINT outbound_lines_ibfk_1 FOREIGN KEY (order_id) REFERENCES outbound_orders(id) ON DELETE RESTRICT,
  ADD CONSTRAINT outbound_product_fk FOREIGN KEY (product_code) REFERENCES master_products(code) ON DELETE RESTRICT;
ALTER TABLE outbound_orders
  DROP INDEX outbound_source_id,
  DROP CHECK outbound_orders_chk_1,
  DROP COLUMN source_id,
  DROP COLUMN source_order_status,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json,
  MODIFY status VARCHAR(16) NOT NULL,
  ADD CHECK (status IN ('open','frozen','confirmed'));
ALTER TABLE master_suppliers
  DROP CHECK master_suppliers_chk_2,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
ALTER TABLE master_customers
  DROP CHECK master_customers_chk_2,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
ALTER TABLE master_warehouses
  DROP CHECK master_warehouses_chk_2,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
ALTER TABLE master_products
  DROP CHECK master_products_chk_2,
  DROP COLUMN source_kind,
  DROP COLUMN source_model,
  DROP COLUMN source_status,
  DROP COLUMN source_del_flag,
  DROP COLUMN source_row_json;
