import { WORKBENCH, workbenchCopy as copy, type WorkbenchPeriod } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { businessText } from '../audit/projection.ts';
import { metric, select } from './metrics.ts';
import { outboundLabel } from './pending.ts';

export async function dashboardVehicles(db: Database, period: WorkbenchPeriod) {
  const rows = await db.all(
    `WITH associations AS (
    SELECT id,vehicle_no FROM outbound_orders WHERE source_del_flag=0 AND source_id IS NULL AND created_at>=? AND created_at<=?
    UNION
    SELECT h.id,s.vehicle_no FROM outbound_shipments s JOIN outbound_orders h ON h.id=s.order_id
    WHERE h.source_del_flag=0 AND h.source_id IS NULL AND s.shipped_at>=? AND s.shipped_at<=?
  ) ${select} a.vehicle_no,o.id,o.order_no,o.status,o.scan_closed_at,
    (SELECT COUNT(DISTINCT id) FROM associations) AS total,COUNT(*) OVER(PARTITION BY a.vehicle_no) AS vehicle_count
    FROM associations a JOIN outbound_orders o ON o.id=a.id
    ORDER BY a.vehicle_no,o.order_no,o.id LIMIT ?`,
    [sqlDate(period.from), sqlDate(period.to), sqlDate(period.from), sqlDate(period.to), WORKBENCH.vehicleLimit],
  );
  return {
    total: metric(Number(rows[0]?.total ?? 0), '单', period),
    items: rows.map((row) => ({
      vehicle: businessText(row.vehicle_no, copy.noVehicle),
      number: businessText(row.order_no, copy.numberMissing),
      label: outboundLabel(row),
      href: `/outbound/${encodeURIComponent(String(row.id))}`,
      count: metric(Number(row.vehicle_count), '单', period),
    })),
  };
}
