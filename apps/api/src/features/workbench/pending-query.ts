import { WORKBENCH } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { select } from './metrics.ts';

export async function pendingRows(db: Database, asOf: string) {
  const staleBefore = sqlDate(new Date(Date.parse(asOf) - WORKBENCH.staleDays * WORKBENCH.dayMs).toISOString());
  return db.all(
    `WITH todos AS (
    SELECT 'inbound' AS kind,r.id,r.receipt_no AS number,r.created_at AS at,r.warehouse_name_snapshot AS warehouse,
      'pending' AS status,NULL AS started,NULL AS scan_closed_at
    FROM inbound_receipts r WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='pending'
    UNION ALL
    SELECT 'outbound',o.id,o.order_no,o.created_at,o.warehouse_name_snapshot,o.status,NULL,o.scan_closed_at
    FROM outbound_orders o WHERE o.source_del_flag=0 AND o.source_id IS NULL AND o.status IN ('open','frozen','partially_shipped')
    UNION ALL
    SELECT 'stocktake',t.id,t.number,t.snapshot_at,w.name,t.status,p.started_at,NULL
    FROM stocktakes t LEFT JOIN master_warehouses w ON w.code=t.warehouse_code
    LEFT JOIN stocktake_windows p ON p.stocktake_id=t.id AND p.active_warehouse=t.warehouse_code WHERE t.status='counting'
    UNION ALL
    SELECT 'stale',o.id,o.order_no,o.scan_closed_at,o.warehouse_name_snapshot,o.status,NULL,o.scan_closed_at
    FROM outbound_orders o WHERE o.source_del_flag=0 AND o.source_id IS NULL
      AND o.status IN ('open','frozen','partially_shipped') AND o.scan_closed_at<=?
  ), ranked AS (
    SELECT todos.*,COUNT(*) OVER(PARTITION BY kind) AS total,
      SUM(IF(status='frozen' AND scan_closed_at IS NULL,1,0)) OVER(PARTITION BY kind) AS missing_time,
      ROW_NUMBER() OVER(PARTITION BY kind ORDER BY at DESC,id DESC) AS position FROM todos
  ) ${select} * FROM ranked WHERE position<=?`,
    [staleBefore, WORKBENCH.todoLimit],
  );
}
