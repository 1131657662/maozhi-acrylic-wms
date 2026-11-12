-- The migration runner rejects non-NULL evidence before executing any DDL.
ALTER TABLE document_correction_lines
  DROP FOREIGN KEY fk_correction_shipment_line,
  DROP INDEX idx_correction_shipment_line,
  DROP COLUMN shipment_line_id;
