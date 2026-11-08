-- Read-only reconciliation, isolated MySQL 8 / port 3307 only.
SELECT h.id,h.device_id,h.expected_count,COUNT(r.fact_id) AS registered,
 COALESCE(SUM(f.payload_hash=r.body_hash),0) AS received_body_matches,
 COALESCE(SUM(r.fact_id IS NOT NULL AND r.context_json IS NULL),0) AS missing_context,h.confirmed_at
FROM pda_handoffs h LEFT JOIN pda_handoff_records r ON r.handoff_id=h.id
LEFT JOIN scan_facts f ON f.id=r.fact_id
GROUP BY h.id,h.device_id,h.expected_count,h.confirmed_at ORDER BY h.id;

SELECT f.plan_id,f.catalog_version,COUNT(*) AS facts,SUM(f.weight_tonnes) AS tonnes,
 SUM(c.fact_id IS NULL) AS missing_context,
 SUM(c.fact_id IS NOT NULL AND (c.catalog_version_id<>f.catalog_version OR c.barcode<>f.barcode
 OR c.weight_tonnes<>f.weight_tonnes)) AS context_mismatches
FROM scan_facts f LEFT JOIN scan_fact_context c ON c.fact_id=f.id
GROUP BY f.plan_id,f.catalog_version ORDER BY f.plan_id,f.catalog_version;

SELECT o.id,o.operation_type,j.product_code,j.packages_before,j.packages_after,j.packages_delta,
 j.tonnes_before,j.tonnes_after,j.tonnes_delta,
 (j.packages_after-j.packages_before=j.packages_delta AND j.tonnes_after-j.tonnes_before=j.tonnes_delta) AS delta_matches
FROM inventory_operations o JOIN stock_journal j ON j.operation_id=o.id ORDER BY o.id;

SELECT product_code,packages,weight_tonnes FROM stock ORDER BY product_code;
