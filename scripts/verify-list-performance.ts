import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedListEvidence } from './e2e-list-fixtures.ts';
import { listWebInbound, inboundPredicate } from '../apps/api/src/features/web-lists/inbound.ts';
import { listWebOutbound } from '../apps/api/src/features/web-lists/outbound.ts';
import { listWebStock } from '../apps/api/src/features/web-lists/stock.ts';
import { listWebAudit } from '../apps/api/src/features/web-lists/audit.ts';
import { listInbound } from '../apps/api/src/features/inbound/repository.ts';
import { stockRows, auditRows } from '../apps/api/src/features/outbound/read-models.ts';
import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
} from '@wms/contracts';

const context = await createTestDatabase();
const report: Record<string, unknown> = { fixture: 'isolated 3307 / 10000 rows per list', runs: 30 };
async function measure(name: string, work: () => Promise<unknown>): Promise<void> {
  const timings: number[] = [];
  for (let n = 0; n < 30; n++) {
    const start = performance.now();
    await work();
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  report[name] = { p50: Number(timings[14]!.toFixed(2)), p95: Number(timings[28]!.toFixed(2)) };
  console.log('B1B1_PERF ' + name + ' ' + JSON.stringify(report[name]));
}
try {
  await seedDemo(context.db, 'perf-only-password');
  await seedListEvidence(context.db, 10000);
  const inbound = webInboundQuerySchema.parse({ keyword: 'WL-RK-', pageSize: 50 });
  await measure('legacy_inbound_50', () => listInbound(context.db, { page: 1, pageSize: 50, keyword: 'WL-RK-' }));
  await measure('web_inbound_50', () => listWebInbound(context.db, inbound));
  await measure('web_inbound_deep_page_200', () => listWebInbound(context.db, { ...inbound, page: 200 }));
  await measure('web_outbound_50', () =>
    listWebOutbound(context.db, webOutboundQuerySchema.parse({ keyword: 'WL-CK-', pageSize: 50 })),
  );
  await measure('legacy_stock_all', () => stockRows(context.db));
  await measure('web_stock_50', () =>
    listWebStock(context.db, webStockQuerySchema.parse({ source: 'erp-product', pageSize: 50 })),
  );
  await measure('legacy_audit_truncated_100', () => auditRows(context.db));
  await measure('web_audit_50', () =>
    listWebAudit(context.db, webAuditQuerySchema.parse({ action: 'list.fixture', pageSize: 50 })),
  );
  const predicate = inboundPredicate(inbound);
  report.explain = await context.db.all(
    'EXPLAIN SELECT r.id ' + predicate.sql + ' ORDER BY r.created_at DESC,r.id DESC LIMIT 50',
    predicate.values,
  );
  report.auditExplain = await context.db.all(
    'EXPLAIN SELECT id,action,created_at FROM operation_log ORDER BY created_at DESC,id DESC LIMIT 50',
  );
  report.reconciliation = await context.db.all(
    "SELECT COUNT(*) AS rows_count,SUM(packages) AS packages,SUM(weight_tonnes) AS tonnes FROM stock WHERE source_del_flag=0 AND product_code LIKE 'WL-P%'",
  );
  assert.equal(Number((report.reconciliation as { rows_count: string }[])[0]!.rows_count), 10000);
  const file = '.local/evidence/b1b1-query-performance.json';
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('B1B1_SQL ' + JSON.stringify(report.reconciliation));
  console.log('B1B1_EXPLAIN ' + JSON.stringify({ inbound: report.explain, audit: report.auditExplain }));
} finally {
  await context.dispose();
}
