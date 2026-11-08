-- New transactions: every journal has complete, arithmetically correct before/after evidence.
SELECT COUNT(*) AS posted_rows,
  COALESCE(SUM(j.packages_after-j.packages_before<>j.packages_delta OR
    j.tonnes_after-j.tonnes_before<>j.tonnes_delta OR o.id IS NULL),0) AS mismatches
FROM stock_journal j LEFT JOIN inventory_operations o ON o.id=j.operation_id
WHERE j.operation_id IS NOT NULL;

-- Current active stock = opening balance of the new transaction chain + all committed deltas.
-- Imported history is excluded; it is not replayed into the current stock snapshot.
WITH movements AS (
  SELECT j.*,ROW_NUMBER() OVER(PARTITION BY warehouse_code,product_code ORDER BY id) AS first_row,
    ROW_NUMBER() OVER(PARTITION BY warehouse_code,product_code ORDER BY id DESC) AS last_row,
    LAG(packages_after) OVER(PARTITION BY warehouse_code,product_code ORDER BY id) AS previous_packages,
    LAG(tonnes_after) OVER(PARTITION BY warehouse_code,product_code ORDER BY id) AS previous_tonnes
  FROM stock_journal j WHERE operation_id IS NOT NULL AND source_del_flag=0
), grouped AS (
  SELECT warehouse_code,product_code,SUM(packages_delta) AS packages_delta,SUM(tonnes_delta) AS tonnes_delta,
    MAX(CASE WHEN first_row=1 THEN packages_before END) AS opening_packages,
    MAX(CASE WHEN first_row=1 THEN tonnes_before END) AS opening_tonnes,
    MAX(CASE WHEN last_row=1 THEN packages_after END) AS last_packages,
    MAX(CASE WHEN last_row=1 THEN tonnes_after END) AS last_tonnes,
    SUM(CASE WHEN first_row>1 AND (previous_packages<>packages_before OR previous_tonnes<>tonnes_before) THEN 1 ELSE 0 END) AS chain_breaks
  FROM movements GROUP BY warehouse_code,product_code
)
SELECT g.*,s.packages AS current_packages,s.weight_tonnes AS current_tonnes,
  (s.packages=g.opening_packages+g.packages_delta AND s.weight_tonnes=g.opening_tonnes+g.tonnes_delta
    AND s.packages=g.last_packages AND s.weight_tonnes=g.last_tonnes AND g.chain_breaks=0) AS balanced
FROM grouped g JOIN stock s ON s.warehouse_code=g.warehouse_code AND s.product_code=g.product_code AND s.source_del_flag=0;
