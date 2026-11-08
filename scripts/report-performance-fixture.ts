import { randomUUID } from 'node:crypto';
import type { Database } from '../apps/api/src/db/mysql.ts';
import { reportMasters } from './report-fixtures.ts';

export async function seedReportPerformance(db: Database, count: number): Promise<void> {
  await reportMasters(db, 'PERF-REPORT');
  const tonne = (n: number) => (n * 0.3001).toFixed(4);
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_id,source_business_type,source_row_json)
      VALUES('PERF-REPORT','PERF-REPORT',0,0,'2025-12-31 12:00:00',?,'import',?)`,
      [
        randomUUID(),
        JSON.stringify({
          create_time: '2025-12-31 12:00:00',
          before_qty: 0,
          after_qty: 0,
          before_weight: '0.0000',
          after_weight: '0.0000',
        }),
      ],
    );
    for (let offset = 0; offset < count; offset += 1000) {
      const values: (string | number)[] = [],
        placeholders: string[] = [];
      for (let n = offset; n < Math.min(count, offset + 1000); n++) {
        placeholders.push("('PERF-REPORT','PERF-REPORT',1,'0.3001','2026-01-05 12:00:00',?,'inbound',?)");
        values.push(
          `perf-${n}`,
          JSON.stringify({
            create_time: '2026-01-05 12:00:00',
            before_qty: n,
            after_qty: n + 1,
            before_weight: tonne(n),
            after_weight: tonne(n + 1),
          }),
        );
      }
      await tx.run(
        `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_id,source_business_type,source_row_json) VALUES ${placeholders.join(',')}`,
        values,
      );
    }
    await tx.run(
      `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json) VALUES('PERF-REPORT','PERF-REPORT',?,?,?)`,
      [count, tonne(count), JSON.stringify({ stock_qty: count, stock_weight: tonne(count) })],
    );
  });
}
