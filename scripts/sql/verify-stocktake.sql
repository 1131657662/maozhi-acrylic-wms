-- Local MySQL 3307 only. Full per-line proof; zero differences must have no journal.
SELECT t.id AS stocktake_id,t.number,s.product_code,s.packages AS snapshot_packages,s.weight_tonnes AS snapshot_tonnes,
 r.packages AS actual_packages,r.weight_tonnes AS actual_tonnes,
 r.packages-s.packages AS expected_packages_delta,r.weight_tonnes-s.weight_tonnes AS expected_tonnes_delta,
 COUNT(j.id) AS journal_count,COALESCE(SUM(j.packages_delta),0) AS journal_packages_delta,COALESCE(SUM(j.tonnes_delta),0) AS journal_tonnes_delta,
 (r.packages IS NOT NULL AND r.packages-s.packages=COALESCE(SUM(j.packages_delta),0)
 AND r.weight_tonnes-s.weight_tonnes=COALESCE(SUM(j.tonnes_delta),0)
 AND COUNT(j.id)=IF(r.packages=s.packages AND r.weight_tonnes=s.weight_tonnes,0,1)) AS balanced
FROM stocktakes t JOIN stocktake_snapshots s ON s.stocktake_id=t.id
JOIN stocktake_readings r ON r.stocktake_id=s.stocktake_id AND r.product_code=s.product_code
LEFT JOIN stock_journal j ON j.operation_id=t.operation_id AND j.warehouse_code=t.warehouse_code AND j.product_code=s.product_code
WHERE t.status='completed'
GROUP BY t.id,t.number,s.product_code,s.packages,s.weight_tonnes,r.packages,r.weight_tonnes
ORDER BY t.id,s.product_code;

-- Every difference journal preserves exact before/after values and operation provenance.
SELECT COUNT(*) AS mismatches FROM stocktakes t JOIN inventory_operations o ON o.id=t.operation_id
JOIN stock_journal j ON j.operation_id=o.id
LEFT JOIN stocktake_snapshots s ON s.stocktake_id=t.id AND s.product_code=j.product_code
LEFT JOIN stocktake_readings r ON r.stocktake_id=t.id AND r.product_code=j.product_code
WHERE o.operation_type<>'stocktake.post' OR o.target_id<>t.id OR CHAR_LENGTH(TRIM(o.reason))=0
 OR s.product_code IS NULL OR j.warehouse_code<>t.warehouse_code OR r.packages IS NULL
 OR j.packages_before<>s.packages OR j.tonnes_before<>s.weight_tonnes
 OR j.packages_after<>r.packages OR j.tonnes_after<>r.weight_tonnes
 OR j.packages_after-j.packages_before<>j.packages_delta OR j.tonnes_after-j.tonnes_before<>j.tonnes_delta;

-- Only completed stocktakes own an inventory operation; each owns exactly one post/audit.
SELECT COUNT(*) AS mismatches FROM stocktakes t WHERE
 (t.status='completed' AND (t.operation_id IS NULL
 OR (SELECT COUNT(*) FROM inventory_operations o WHERE o.operation_type='stocktake.post' AND o.target_id=t.id)<>1
 OR (SELECT COUNT(*) FROM operation_log a WHERE a.action='stocktake.post' AND a.target_id=t.id)<>1))
 OR (t.status<>'completed' AND (t.operation_id IS NOT NULL
 OR EXISTS(SELECT 1 FROM inventory_operations o WHERE o.operation_type='stocktake.post' AND o.target_id=t.id)));

-- Closed stocktakes release the persistent pause. Counting stocktakes retain it.
SELECT COUNT(*) AS mismatches FROM stocktakes t LEFT JOIN stocktake_windows w ON w.stocktake_id=t.id
WHERE w.stocktake_id IS NULL OR w.warehouse_code<>t.warehouse_code
 OR (t.status='counting' AND w.released_at IS NOT NULL) OR (t.status<>'counting' AND w.released_at IS NULL);

-- Current balances equal the last fully evidenced journal, regardless of later legitimate operations.
SELECT COUNT(*) AS mismatches FROM stock_journal j
LEFT JOIN stock s ON s.warehouse_code=j.warehouse_code AND s.product_code=j.product_code AND s.source_del_flag=0
WHERE j.source_del_flag=0 AND j.operation_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM stock_journal later WHERE later.warehouse_code=j.warehouse_code
   AND later.product_code=j.product_code AND later.source_del_flag=0 AND later.id>j.id)
 AND (s.product_code IS NULL OR s.packages<>j.packages_after OR s.weight_tonnes<>j.tonnes_after);
