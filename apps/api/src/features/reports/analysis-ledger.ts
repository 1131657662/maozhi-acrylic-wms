import type { Database } from '../../db/mysql.ts';
import type { LedgerEvent } from './types.ts';
import { normalizeEvent, analysisHistoricalEvents } from './normalize.ts';
import { historicalPostedLocal, ledgerFields, ledgerFrom } from './sql.ts';
import type { ReportSnapshot } from './snapshot.ts';

const compactable = `s.source_id IS NOT NULL AND s.operation_id IS NULL AND s.correction_id IS NULL
  AND (s.source_order_no IS NULL OR s.source_order_no='') AND s.inbound_receipt_id IS NULL AND s.order_id IS NULL`;

export async function analysisLedger(db: Database, snapshot: ReportSnapshot): Promise<LedgerEvent[]> {
  // FIFO must retain every original balance and sequence; read narrow evidence, never collapse the balance chain.
  const historicalRead = db.all(
    `SELECT s.id,s.warehouse_code AS warehouseCode,s.product_code AS productCode,
      ${historicalPostedLocal} AS reportLocalTime,s.source_business_type,s.source_del_flag,
      s.packages_delta,s.tonnes_delta,s.source_row_json
    FROM stock_journal s JOIN master_products p ON p.code=s.product_code AND p.inventory_eligible=1
    WHERE s.id<=? AND (${compactable}) ORDER BY s.id`,
    [snapshot.watermarks.journalMaxId],
  );
  const linkedRead = db.all(
    `SELECT /*+ NO_BNL(p,w,o) */ STRAIGHT_JOIN ${ledgerFields} ${ledgerFrom}
    WHERE s.id<=? AND NOT (${compactable}) ORDER BY s.id`,
    [snapshot.watermarks.journalMaxId],
  );
  // Both reads use the same transaction connection. Queue them before normalizing rows so
  // an independent aggregation can execute in MySQL while Node builds the balance projection.
  const [historical, linked] = await Promise.all([historicalRead, linkedRead]);
  return [...analysisHistoricalEvents(historical), ...linked.map(normalizeEvent)].sort(
    (left, right) => left.sequence - right.sequence,
  );
}
