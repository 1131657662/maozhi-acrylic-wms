-- Read-only independent check. Set @report_start / @report_end on the same connection.
-- Bounds are Shanghai local [start, end). Historical values are NOT shifted by eight hours.
WITH raw AS (
 SELECT j.id,j.warehouse_code,j.product_code,j.packages_delta AS dq,j.tonnes_delta AS dw,
  COALESCE(o.operation_type,j.source_business_type,'unknown') AS kind,
  CASE WHEN j.source_id IS NOT NULL THEN JSON_UNQUOTE(JSON_EXTRACT(j.source_row_json,'$.create_time'))
   ELSE DATE_FORMAT(DATE_ADD(o.created_at,INTERVAL 8 HOUR),'%Y-%m-%d %H:%i:%s.%f') END AS stamp,
  CASE WHEN j.source_id IS NOT NULL THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.source_row_json,'$.before_qty')),'null') AS SIGNED) ELSE j.packages_before END AS bq,
  CASE WHEN j.source_id IS NOT NULL THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.source_row_json,'$.before_weight')),'null') AS DECIMAL(20,4)) ELSE j.tonnes_before END AS bw,
  CASE WHEN j.source_id IS NOT NULL THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.source_row_json,'$.after_qty')),'null') AS SIGNED) ELSE j.packages_after END AS aq,
  CASE WHEN j.source_id IS NOT NULL THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.source_row_json,'$.after_weight')),'null') AS DECIMAL(20,4)) ELSE j.tonnes_after END AS aw
 FROM stock_journal j JOIN master_products p ON p.code=j.product_code AND p.source_kind='erp-product'
 LEFT JOIN inventory_operations o ON o.id=j.operation_id WHERE j.source_del_flag=0
), opening_candidates AS (
 SELECT warehouse_code,product_code,stamp,id,aq,aw,0 AS boundary FROM raw WHERE stamp<@report_start
 UNION ALL
 SELECT warehouse_code,product_code,stamp,-id AS id,bq AS aq,bw AS aw,1 AS boundary FROM raw
 WHERE LEFT(stamp,19)=@report_start AND SUBSTRING(stamp,21) NOT REGEXP '[1-9]'
), opening AS (
 SELECT opening_candidates.*,ROW_NUMBER() OVER(PARTITION BY warehouse_code,product_code ORDER BY boundary,stamp DESC,id DESC) AS rn
 FROM opening_candidates
), closing AS (
 SELECT raw.*,ROW_NUMBER() OVER(PARTITION BY warehouse_code,product_code ORDER BY stamp DESC,id DESC) AS rn
 FROM raw WHERE stamp<@report_end
), movement AS (
 SELECT warehouse_code,product_code,
  SUM(CASE WHEN kind IN('inbound','inbound.confirm','inbound.reverse') THEN dq ELSE 0 END) AS iq,
  SUM(CASE WHEN kind IN('inbound','inbound.confirm','inbound.reverse') THEN dw ELSE 0 END) AS iw,
  SUM(CASE WHEN kind IN('outbound','outbound.confirm','outbound.reverse') THEN -dq ELSE 0 END) AS oq,
  SUM(CASE WHEN kind IN('outbound','outbound.confirm','outbound.reverse') THEN -dw ELSE 0 END) AS ow,
  SUM(CASE WHEN kind NOT IN('inbound','inbound.confirm','inbound.reverse','outbound','outbound.confirm','outbound.reverse') THEN dq ELSE 0 END) AS adjq,
  SUM(CASE WHEN kind NOT IN('inbound','inbound.confirm','inbound.reverse','outbound','outbound.confirm','outbound.reverse') THEN dw ELSE 0 END) AS adjw
 FROM raw WHERE stamp>=@report_start AND stamp<@report_end GROUP BY warehouse_code,product_code
), dimensions AS (
 SELECT warehouse_code,product_code FROM raw
 UNION SELECT s.warehouse_code,s.product_code FROM stock s JOIN master_products p ON p.code=s.product_code AND p.source_kind='erp-product' WHERE s.source_del_flag=0
)
SELECT d.warehouse_code,d.product_code,b.aq AS opening_packages,b.aw AS opening_tonnes,
 COALESCE(m.iq,0) AS inbound_packages,COALESCE(m.iw,0) AS inbound_tonnes,
 COALESCE(m.oq,0) AS outbound_packages,COALESCE(m.ow,0) AS outbound_tonnes,
 COALESCE(m.adjq,0) AS adjustment_packages,COALESCE(m.adjw,0) AS adjustment_tonnes,
 e.aq AS closing_packages,e.aw AS closing_tonnes,
 e.aq-b.aq-COALESCE(m.iq,0)+COALESCE(m.oq,0)-COALESCE(m.adjq,0) AS difference_packages,
 e.aw-b.aw-COALESCE(m.iw,0)+COALESCE(m.ow,0)-COALESCE(m.adjw,0) AS difference_tonnes
FROM dimensions d
LEFT JOIN opening b ON b.warehouse_code=d.warehouse_code AND b.product_code=d.product_code AND b.rn=1
LEFT JOIN closing e ON e.warehouse_code=d.warehouse_code AND e.product_code=d.product_code AND e.rn=1
LEFT JOIN movement m ON m.warehouse_code=d.warehouse_code AND m.product_code=d.product_code
ORDER BY d.warehouse_code,d.product_code;
