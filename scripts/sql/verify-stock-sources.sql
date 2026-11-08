-- Read-only MySQL 8 verification. Run in the selected local 3307 database.
-- This deliberately calculates an invalid cross-source total ONLY to detect it in display candidates.
-- Zero/equal/opposite subtotals can produce numerical coincidences; equality alone is not provenance.
WITH sources AS (
  SELECT 'erp-product' AS source UNION ALL SELECT 'sku-spec' UNION ALL SELECT 'unclassified'
), scoped AS (
  SELECT s.*, CASE WHEN p.source_kind IN ('erp-product','sku-spec')
    THEN p.source_kind ELSE 'unclassified' END AS source
  FROM stock s LEFT JOIN master_products p ON p.code=s.product_code WHERE s.source_del_flag=0
)
SELECT sources.source,COUNT(scoped.product_code) AS stock_rows,
  CASE WHEN sources.source='unclassified' THEN NULL ELSE COALESCE(SUM(scoped.packages),0) END AS packages,
  CASE WHEN sources.source='unclassified' THEN NULL ELSE COALESCE(SUM(scoped.weight_tonnes),0) END AS tonnes
FROM sources LEFT JOIN scoped ON scoped.source=sources.source GROUP BY sources.source ORDER BY sources.source;

WITH scoped AS (
  SELECT s.*,CASE WHEN p.source_kind IN ('erp-product','sku-spec')
    THEN p.source_kind ELSE 'unclassified' END AS source
  FROM stock s LEFT JOIN master_products p ON p.code=s.product_code WHERE s.source_del_flag=0
), subtotal AS (
  SELECT source,SUM(packages) AS packages,SUM(weight_tonnes) AS tonnes FROM scoped
  WHERE source IN ('erp-product','sku-spec') GROUP BY source
), journal AS (
  SELECT j.*,CASE WHEN p.source_kind IN ('erp-product','sku-spec')
    THEN p.source_kind ELSE 'unclassified' END AS source,
    ROW_NUMBER() OVER (PARTITION BY CASE WHEN p.source_kind IN ('erp-product','sku-spec')
      THEN p.source_kind ELSE 'unclassified' END ORDER BY j.id DESC) AS row_num
  FROM stock_journal j LEFT JOIN master_products p ON p.code=j.product_code WHERE j.source_del_flag=0
), candidates AS (
  SELECT source,'packages' AS metric,packages AS value FROM scoped
  UNION ALL SELECT source,'tonnes',weight_tonnes FROM scoped
  UNION ALL SELECT source,'packages',packages FROM subtotal
  UNION ALL SELECT source,'tonnes',tonnes FROM subtotal
  UNION ALL SELECT source,'packages',packages_delta FROM journal WHERE row_num<=20
  UNION ALL SELECT source,'tonnes',tonnes_delta FROM journal WHERE row_num<=20
), invalid_total AS (
  SELECT 'packages' AS metric,COALESCE(SUM(packages),0) AS value FROM subtotal
  UNION ALL SELECT 'tonnes',COALESCE(SUM(tonnes),0) FROM subtotal
)
SELECT i.metric,i.value AS forbidden_cross_source_value,
  SUM(CASE WHEN c.value=i.value THEN 1 ELSE 0 END) AS display_value_matches
FROM invalid_total i LEFT JOIN candidates c ON c.metric=i.metric GROUP BY i.metric,i.value;
