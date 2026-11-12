import { unpostedDocumentSchema, type Stocktake } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { decimalToGrams } from '../../db/weight.ts';

export async function unpostedDocuments(db: Database, take: Stocktake) {
  const args = [take.warehouseCode, sqlDate(take.snapshotAt)];
  const inbound = await db.all(
    `SELECT h.id,h.receipt_no AS number,h.status,SUM(l.packages) AS packages,
    SUM(l.weight_tonnes) AS tonnes FROM inbound_receipts h JOIN inbound_lines l ON l.receipt_id=h.id AND l.source_del_flag=0
    WHERE h.warehouse_code=? AND h.created_at>=? AND h.source_del_flag=0 AND h.posting_state='pending'
    GROUP BY h.id,h.receipt_no,h.status ORDER BY h.id`,
    args,
  );
  const outbound = await db.all(
    `SELECT h.id,h.order_no AS number,h.status,h.revision,
    COALESCE(p.packages,0) AS packages,COALESCE(p.tonnes,0) AS tonnes,
    COALESCE(f.packages,0) AS scanned_packages,COALESCE(f.tonnes,0) AS scanned_tonnes
    FROM outbound_orders h
    LEFT JOIN (SELECT order_id,SUM(planned_packages) AS packages,SUM(planned_weight_tonnes) AS tonnes
      FROM outbound_lines WHERE source_del_flag=0 GROUP BY order_id) p ON p.order_id=h.id
    LEFT JOIN (SELECT plan_id,COUNT(*) AS packages,SUM(weight_tonnes) AS tonnes,MAX(received_at) AS last_received
      FROM scan_facts WHERE revoked_at IS NULL GROUP BY plan_id) f ON f.plan_id=h.id
    WHERE h.warehouse_code=? AND h.source_id IS NULL AND h.source_del_flag=0 AND h.status IN ('open','frozen')
    AND (h.created_at>=? OR f.last_received>=? OR EXISTS(SELECT 1 FROM operation_log a
      WHERE a.target_id=h.id AND a.action IN ('outbound.plan.update','scan.freeze') AND a.created_at>=?)) ORDER BY h.id`,
    [...args, args[1]!, args[1]!],
  );
  return [
    ...inbound.map((r) =>
      unpostedDocumentSchema.parse({
        kind: 'inbound',
        id: r.id,
        number: r.number,
        status: r.status,
        packages: Number(r.packages),
        weightGrams: decimalToGrams(r.tonnes),
        scannedPackages: null,
        scannedWeightGrams: null,
        revision: 0,
      }),
    ),
    ...outbound.map((r) =>
      unpostedDocumentSchema.parse({
        kind: 'outbound',
        id: r.id,
        number: r.number,
        status: r.status,
        packages: Number(r.packages),
        weightGrams: decimalToGrams(r.tonnes),
        scannedPackages: Number(r.scanned_packages),
        scannedWeightGrams: decimalToGrams(r.scanned_tonnes),
        revision: Number(r.revision),
      }),
    ),
  ];
}
// Acquire before the first consistent read: scan/edit/freeze take these same order locks.
// The inventory writer lock also serializes document creation; no new unposted row can slip into commit.
export async function lockUnpostedOrders(db: Database, warehouse: string): Promise<void> {
  await db.all(
    `SELECT id FROM outbound_orders WHERE warehouse_code=? AND source_id IS NULL
    AND status IN ('open','frozen') ORDER BY id FOR UPDATE`,
    [warehouse],
  );
}
