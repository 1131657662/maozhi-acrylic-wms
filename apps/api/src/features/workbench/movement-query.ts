import type { Database } from '../../db/mysql.ts';
import { WORKBENCH, type WorkbenchPeriod } from '@wms/contracts';
import { balanceFrom, postedLocal, validPosted } from '../reports/sql.ts';
import { localTime, select } from './metrics.ts';

// Reduce only additive deltas, preserving every input to the report classification.
// Each group is normalized and accumulated by the same functions as the monthly report.
export async function movementGroups(db: Database, period: WorkbenchPeriod) {
  const earliest = new Date(Date.parse(period.from) - (WORKBENCH.trendDays - 1) * WORKBENCH.dayMs).toISOString();
  const previousEnd = new Date(Date.parse(period.to) - WORKBENCH.dayMs).toISOString();
  return db.all(
    `${select} LEFT(${postedLocal},10) AS day,
    (${postedLocal}<=?) AS previousWindow,MIN(s.id) AS id,
    MIN(${postedLocal}) AS reportLocalTime,o.operation_type,s.source_business_type,
    IF(s.source_id IS NULL,NULL,'historical') AS source_id,
    IF(sc.inbound_receipt_id IS NULL,NULL,'inbound') AS correctionInboundId,
    IF(sc.outbound_order_id IS NULL,NULL,'outbound') AS correctionOutboundId,
    SUM(s.packages_delta) AS packages_delta,SUM(s.tonnes_delta) AS tonnes_delta
    ${balanceFrom} WHERE s.source_del_flag=0 AND ${validPosted}
    AND ${postedLocal}>=? AND ${postedLocal}<=?
    GROUP BY day,previousWindow,o.operation_type,s.source_business_type,
      (s.source_id IS NULL),(sc.inbound_receipt_id IS NULL),(sc.outbound_order_id IS NULL)`,
    [localTime(previousEnd), localTime(earliest), localTime(period.to)],
  );
}
export async function movementUnknowns(db: Database) {
  return db.get(`${select}
    SUM(CASE WHEN p.inventory_eligible=1 AND COALESCE(${validPosted},0)=0 THEN 1 ELSE 0 END) AS missingTime,
    SUM(CASE WHEN p.code IS NULL OR (p.inventory_eligible=0 AND p.source_kind<>'sku-spec') THEN 1 ELSE 0 END) AS missingSource
    FROM stock_journal s LEFT JOIN master_products p ON p.code=s.product_code
    LEFT JOIN inventory_operations o ON o.id=s.operation_id WHERE s.source_del_flag=0`);
}
