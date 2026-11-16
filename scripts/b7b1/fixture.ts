import assert from 'node:assert/strict';
import { WORKBENCH, shanghaiToday } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { seedPerformanceLines } from '../b6b/fixture.ts';
import { seedReportPerformance } from '../report-performance-fixture.ts';
import { createStocktake } from '../../apps/api/src/features/stocktake/create.ts';
import { randomUUID } from 'node:crypto';

export async function seedWorkbenchPerformance(db: Database) {
  assert.match(String((await db.get('SELECT DATABASE() AS name'))?.name), /^maozhi_test_[a-f0-9]{24}$/);
  const documents = await seedPerformanceLines(db);
  await seedReportPerformance(db, 100_000);
  const first = new Date(Date.parse(`${shanghaiToday()}T00:00:00Z`) - (WORKBENCH.trendDays - 1) * WORKBENCH.dayMs)
    .toISOString()
    .slice(0, 10);
  // Preserve the existing synthetic balance chain while distributing evidence across the live 14-day window.
  await db.run(
    `UPDATE stock_journal SET source_row_json=JSON_SET(source_row_json,'$.create_time',
    DATE_FORMAT(DATE_ADD(?, INTERVAL FLOOR(CAST(SUBSTRING(source_id,6) AS UNSIGNED)*14/100000) DAY),'%Y-%m-%d 00:00:00'))
    WHERE product_code='PERF-REPORT' AND source_id LIKE 'perf-%'`,
    [first],
  );
  for (const table of ['inbound_receipts', 'outbound_orders'])
    await db.run(
      `UPDATE ${table} SET created_at=DATE_SUB(DATE_ADD(?,
      INTERVAL FLOOR(CAST(SUBSTRING(id,5) AS UNSIGNED)*14/10000) DAY),INTERVAL 8 HOUR) WHERE id LIKE 'WL-%'`,
      [first],
    );
  await db.run(
    "UPDATE outbound_orders SET scan_closed_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id LIKE 'WL-O%' AND MOD(CAST(SUBSTRING(id,5) AS UNSIGNED),10)=0",
  );
  await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), { username: 'owner', traceId: 'b7b-perf' });
  await db.all('ANALYZE TABLE inbound_receipts,outbound_orders,stock_journal,master_products,operation_log');
  const journal = Number((await db.get('SELECT COUNT(*) AS total FROM stock_journal'))?.total);
  assert.ok(journal >= 100_000);
  return { documents, journal, first, last: shanghaiToday() };
}
