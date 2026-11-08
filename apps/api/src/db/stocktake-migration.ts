import type { Database } from './mysql.ts';

// InnoDB may replace an implicit FK index with a newly added covering index.
// Restore a supporting index before removing 009's index; never disable FK checks.
export async function prepareStocktakeDown(db: Database): Promise<void> {
  for (const [table, index, base] of [
    ['outbound_orders', 'outbound_warehouse_status', 'outbound_warehouse_fk'],
    ['inbound_receipts', 'inbound_warehouse_time', 'warehouse_code'],
  ]) {
    const support = await db.get(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='warehouse_code' AND SEQ_IN_INDEX=1
      AND INDEX_NAME<>? LIMIT 1`,
      [table!, index!],
    );
    if (!support) await db.run(`CREATE INDEX ${base} ON ${table}(warehouse_code)`);
  }
}
