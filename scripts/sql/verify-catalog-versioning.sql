SELECT COUNT(*) AS v1_entries,COUNT(DISTINCT source_spec) AS specifications,COALESCE(SUM(weight_tonnes),0) AS tonnes
FROM catalog_entries WHERE version_id=1;
SELECT COUNT(*) AS missing_or_changed FROM scan_catalog_v1_archive a
LEFT JOIN catalog_entries e ON e.version_id=1 AND e.barcode=a.barcode
WHERE e.barcode IS NULL OR e.weight_tonnes<>a.weight_tonnes OR NOT(e.source_spec<=>a.source_spec)
OR NOT(e.legacy_product_code<=>a.product_code);
SELECT COUNT(*) AS extra_v1 FROM catalog_entries e LEFT JOIN scan_catalog_v1_archive a ON a.barcode=e.barcode
WHERE e.version_id=1 AND a.barcode IS NULL;
SELECT COUNT(*) AS facts,COALESCE(SUM(weight_tonnes),0) AS tonnes FROM scan_facts;
SELECT catalog_version,COUNT(*) AS facts,SUM(weight_tonnes) AS tonnes FROM scan_facts GROUP BY catalog_version;
SELECT COUNT(*) AS invalid_context FROM scan_facts f LEFT JOIN scan_fact_context c ON c.fact_id=f.id
WHERE c.fact_id IS NULL OR c.catalog_version_id<>f.catalog_version OR c.barcode<>f.barcode OR c.weight_tonnes<>f.weight_tonnes;
