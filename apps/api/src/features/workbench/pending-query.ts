import { WORKBENCH } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { select } from './metrics.ts';

const outbound =
  "FROM outbound_orders o WHERE o.source_del_flag=0 AND o.source_id IS NULL AND o.status IN ('open','frozen','partially_shipped')";
const categories = [
  {
    kind: 'inbound',
    fields:
      "r.id,r.receipt_no AS number,r.created_at AS at,r.warehouse_name_snapshot AS warehouse,'pending' AS status,NULL AS started,NULL AS scan_closed_at",
    from: "FROM inbound_receipts r WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='pending'",
    missing: '0',
  },
  {
    kind: 'outbound',
    fields:
      'o.id,o.order_no AS number,o.created_at AS at,o.warehouse_name_snapshot AS warehouse,o.status,NULL AS started,o.scan_closed_at',
    from: outbound,
    missing: "SUM(IF(o.status='frozen' AND o.scan_closed_at IS NULL,1,0))",
  },
  {
    kind: 'stocktake',
    fields:
      't.id,t.number,t.snapshot_at AS at,w.name AS warehouse,t.status,p.started_at AS started,NULL AS scan_closed_at',
    from: "FROM stocktakes t LEFT JOIN master_warehouses w ON w.code=t.warehouse_code LEFT JOIN stocktake_windows p ON p.stocktake_id=t.id AND p.active_warehouse=t.warehouse_code WHERE t.status='counting'",
    missing: '0',
  },
  {
    kind: 'stale',
    fields:
      'o.id,o.order_no AS number,o.scan_closed_at AS at,o.warehouse_name_snapshot AS warehouse,o.status,NULL AS started,o.scan_closed_at',
    from: outbound + ' AND o.scan_closed_at<=?',
    missing: '0',
  },
] as const;
// Count narrow rows separately from four bounded top-N projections: no wide all-document window sort.
const counts = categories
  .map((c) => `SELECT '${c.kind}' AS kind,COUNT(*) AS total,${c.missing} AS missing_time ${c.from}`)
  .join(' UNION ALL ');
const items = categories
  .map(
    (c) => `(SELECT '${c.kind}' AS kind,${c.fields} ${c.from} ORDER BY at DESC,id DESC LIMIT ${WORKBENCH.todoLimit})`,
  )
  .join(' UNION ALL ');
export async function pendingRows(db: Database, asOf: string) {
  const staleBefore = sqlDate(new Date(Date.parse(asOf) - WORKBENCH.staleDays * WORKBENCH.dayMs).toISOString());
  return db.all(
    `WITH counts AS (${counts}),items AS (${items})
    ${select} items.*,counts.total,counts.missing_time FROM items JOIN counts ON counts.kind=items.kind
    ORDER BY items.kind,items.at DESC,items.id DESC`,
    [staleBefore, staleBefore],
  );
}
