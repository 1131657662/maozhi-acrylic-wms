ALTER TABLE outbound_lines DROP COLUMN line_position, DROP COLUMN scan_packages, DROP COLUMN scan_weight_grams;
DROP TABLE outbound_shipment_lines;
DROP TABLE outbound_shipments;
ALTER TABLE document_correction_lines
  DROP CHECK correction_original_line_matches,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY(correction_id,product_code),
  DROP COLUMN original_line_id;
