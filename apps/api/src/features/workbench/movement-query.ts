import type { Database } from '../../db/mysql.ts';
import { WORKBENCH, type WorkbenchPeriod } from '@wms/contracts';
import { historicalPostedLocal, validReportTime } from '../reports/sql.ts';
import { localTime, select } from './metrics.ts';

// Materialize once, then validate each distinct timestamp/classification instead of re-parsing JSON per predicate.
// Only additive deltas are reduced; report normalizeEvent/addMovement still determine every effective movement.
const sourceTime = `CAST(${historicalPostedLocal} AS CHAR(32)) COLLATE utf8mb4_0900_bin`;
const groups = `WITH journal AS (
  SELECT ${sourceTime} AS sourceTime,NULL AS localCreated,s.product_code,
    NULL AS operation_id,NULL AS correction_id,s.source_business_type,'historical' AS source_id,
    COUNT(*) AS rowCount,MIN(s.id) AS id,SUM(s.packages_delta) AS packages_delta,SUM(s.tonnes_delta) AS tonnes_delta
  FROM stock_journal s WHERE s.source_del_flag=0 AND s.source_id IS NOT NULL AND s.operation_id IS NULL AND s.correction_id IS NULL
  GROUP BY sourceTime,s.product_code,s.source_business_type
  UNION ALL
  SELECT ${sourceTime},s.created_at,s.product_code,s.operation_id,s.correction_id,s.source_business_type,
    IF(s.source_id IS NULL,NULL,'historical'),1,s.id,s.packages_delta,s.tonnes_delta
  FROM stock_journal s WHERE s.source_del_flag=0 AND (s.source_id IS NULL OR s.operation_id IS NOT NULL OR s.correction_id IS NOT NULL)
), grouped AS (
  SELECT CASE WHEN s.source_id IS NOT NULL THEN s.sourceTime
    ELSE DATE_FORMAT(DATE_ADD(COALESCE(o.created_at,s.localCreated),INTERVAL 8 HOUR),'%Y-%m-%d %H:%i:%s.%f') END AS reportLocalTime,
    o.operation_type,s.source_business_type,s.source_id,
    IF(sc.inbound_receipt_id IS NULL,NULL,'inbound') AS correctionInboundId,
    IF(sc.outbound_order_id IS NULL,NULL,'outbound') AS correctionOutboundId,
    p.inventory_eligible,p.source_kind,(p.code IS NULL) AS missingProduct,s.rowCount,s.id,s.packages_delta,s.tonnes_delta
  FROM journal s LEFT JOIN master_products p ON p.code=s.product_code
    LEFT JOIN inventory_operations o ON o.id=s.operation_id
    LEFT JOIN document_corrections sc ON sc.id=s.correction_id
)`;
const valid = validReportTime('reportLocalTime');
export async function movementGroups(db: Database, period: WorkbenchPeriod) {
  const earliest = new Date(Date.parse(period.from) - (WORKBENCH.trendDays - 1) * WORKBENCH.dayMs).toISOString();
  const previousEnd = new Date(Date.parse(period.to) - WORKBENCH.dayMs).toISOString();
  return db.all(
    `${groups}
    ${select} LEFT(reportLocalTime,10) AS day,(reportLocalTime<=?) AS previousWindow,
      MIN(id) AS id,MIN(reportLocalTime) AS reportLocalTime,operation_type,source_business_type,source_id,
      correctionInboundId,correctionOutboundId,SUM(packages_delta) AS packages_delta,SUM(tonnes_delta) AS tonnes_delta,
      0 AS correctionOffsetPackages,CAST(0 AS DECIMAL(18,4)) AS correctionOffsetTonnes,
      0 AS missingTime,0 AS missingSource
    FROM grouped WHERE inventory_eligible=1 AND ${valid} AND reportLocalTime>=? AND reportLocalTime<=?
    GROUP BY day,previousWindow,operation_type,source_business_type,source_id,correctionInboundId,correctionOutboundId
    UNION ALL
    SELECT NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,0,CAST(0 AS DECIMAL(18,4)),0,CAST(0 AS DECIMAL(18,4)),
      SUM(IF(inventory_eligible=1 AND COALESCE(${valid},0)=0,rowCount,0)),
      SUM(IF(missingProduct OR (inventory_eligible=0 AND source_kind<>'sku-spec'),rowCount,0)) FROM grouped`,
    [localTime(previousEnd), localTime(earliest).slice(0, 19), localTime(period.to)],
  );
}
