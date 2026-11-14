import { unpostedDocumentSchema, type Stocktake } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate, sqlDate } from '../../db/dates.ts';
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
    COALESCE(f.packages,0) AS scanned_packages,COALESCE(f.tonnes,0) AS scanned_tonnes,
    COALESCE(f.received_records,0) AS received_records,f.last_received,q.unreceived_records
    FROM outbound_orders h
    LEFT JOIN (SELECT order_id,SUM(planned_packages) AS packages,SUM(planned_weight_tonnes) AS tonnes
      FROM outbound_lines WHERE source_del_flag=0 GROUP BY order_id) p ON p.order_id=h.id
    LEFT JOIN (SELECT plan_id,COUNT(*) AS received_records,MAX(received_at) AS last_received,
      SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS packages,
      SUM(CASE WHEN revoked_at IS NULL THEN weight_tonnes ELSE 0 END) AS tonnes
      FROM scan_facts GROUP BY plan_id) f ON f.plan_id=h.id
    LEFT JOIN (SELECT r.plan_id,COUNT(DISTINCT CASE WHEN f.id IS NULL THEN r.fact_id END) AS unreceived_records
      FROM pda_handoff_records r LEFT JOIN scan_facts f ON f.id=r.fact_id AND f.payload_hash=r.body_hash
      GROUP BY r.plan_id) q ON q.plan_id=h.id
    WHERE h.warehouse_code=? AND h.source_id IS NULL AND h.source_del_flag=0
    AND h.status IN ('open','frozen','partially_shipped')
    AND (h.status='partially_shipped' OR h.created_at>=? OR f.last_received>=? OR EXISTS(SELECT 1 FROM operation_log a
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
        receivedRecords: null,
        lastReceivedAt: null,
        unreceivedRecords: null,
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
        receivedRecords: Number(r.received_records),
        lastReceivedAt: r.last_received === null ? null : isoDate(r.last_received),
        unreceivedRecords: r.unreceived_records === null ? null : Number(r.unreceived_records),
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
    AND source_del_flag=0 AND status IN ('open','frozen','partially_shipped') ORDER BY id FOR UPDATE`,
    [warehouse],
  );
  await db.all(
    `SELECT l.id FROM outbound_lines l JOIN outbound_orders h ON h.id=l.order_id
    WHERE h.warehouse_code=? AND h.source_id IS NULL AND h.source_del_flag=0
    AND h.status IN ('open','frozen','partially_shipped') ORDER BY l.order_id,l.id FOR UPDATE`,
    [warehouse],
  );
}
