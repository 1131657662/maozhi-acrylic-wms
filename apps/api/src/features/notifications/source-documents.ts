import { MESSAGES, WORKBENCH } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';

export const messageSelect = `SELECT /*+ MAX_EXECUTION_TIME(${MESSAGES.queryTimeoutMs}) */`;
const outbound = "source_id IS NULL AND source_del_flag=0 AND status IN ('open','frozen','partially_shipped')";
export function before(now: Date, milliseconds: number): string {
  return sqlDate(new Date(now.getTime() - milliseconds).toISOString());
}
export async function pendingSources(db: Database, now: Date) {
  const threshold = before(now, MESSAGES.pendingHours * MESSAGES.hourMs);
  return db.all(
    `${messageSelect} 'inbound' AS object_type,id,receipt_no AS name,created_at AS anchor
    FROM inbound_receipts WHERE source_id IS NULL AND source_del_flag=0 AND posting_state='pending' AND created_at<=?
    UNION ALL SELECT 'outbound',id,order_no,scan_closed_at FROM outbound_orders WHERE ${outbound} AND scan_closed_at<=?`,
    [threshold, threshold],
  );
}
export async function overdueSources(db: Database, now: Date) {
  return db.all(
    `${messageSelect} 'outbound' AS object_type,id,order_no AS name,scan_closed_at AS anchor
    FROM outbound_orders WHERE ${outbound} AND scan_closed_at<=?`,
    [before(now, WORKBENCH.staleDays * MESSAGES.dayMs)],
  );
}
export async function stocktakeSources(db: Database, now: Date) {
  return db.all(
    `${messageSelect} 'stocktake' AS object_type,t.id,t.number AS name,w.started_at AS anchor
    FROM stocktakes t JOIN stocktake_windows w ON w.stocktake_id=t.id AND w.active_warehouse=t.warehouse_code
    WHERE t.status='counting' AND w.started_at<=?`,
    [before(now, WORKBENCH.lockHours * MESSAGES.hourMs)],
  );
}
export async function catalogSources(db: Database, now: Date) {
  return db.all(
    `${messageSelect} 'catalog' AS object_type,CAST(h.id AS CHAR) AS id,'' AS name,
    CAST(v.version_id AS CHAR) AS anchor FROM catalog_head h JOIN catalog_versions v ON v.version_id=h.active_version_id
    WHERE h.id=1 AND v.published_at<=?`,
    [before(now, WORKBENCH.catalogDays * MESSAGES.dayMs)],
  );
}
