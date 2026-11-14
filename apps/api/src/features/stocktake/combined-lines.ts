// Both branches have one row per product. The immutable snapshot remains a separate source of truth.
export const combinedLines = `SELECT s.stocktake_id,s.product_code,s.product_name,s.packages,s.weight_tonnes,
 r.packages AS actual_packages,r.weight_tonnes AS actual_tonnes,r.revision,
 NULL AS discovery_id,NULL AS reason,NULL AS actor,NULL AS created_at,NULL AS updated_at
 FROM stocktake_snapshots s JOIN stocktake_readings r USING(stocktake_id,product_code)
 WHERE s.stocktake_id=?
 UNION ALL
 SELECT d.stocktake_id,d.product_code,p.name,0,CAST(0 AS DECIMAL(12,4)),d.packages,
 CAST(d.weight_grams/1000000 AS DECIMAL(12,4)),d.version,d.id,d.reason,d.actor,d.created_at,d.updated_at
 FROM stocktake_discovery_lines d JOIN master_products p ON p.code=d.product_code
 WHERE d.stocktake_id=?`;
