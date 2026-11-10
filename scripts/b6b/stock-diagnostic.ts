import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { listFields, type ExportRequest } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { exportReader } from '../../apps/api/src/features/web-exports/read.ts';
import { generateSnapshot } from '../../apps/api/src/features/web-exports/generate.ts';
import { newExportJob } from '../../apps/api/src/features/web-exports/job.ts';
import { XlsxWriter, type ExportWriter } from '../../apps/api/src/features/web-exports/writer.ts';
import { measurement, probe } from './probe.ts';

async function stockFixture(db: Database): Promise<void> {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  assert.match(name, /^maozhi_test_[a-f0-9]{24}$/);
  for (let start = 10_000; start < 100_000; start += 500) {
    const codes = Array.from({ length: 500 }, (_, i) => 'WL-P' + String(start + i).padStart(6, '0'));
    await db.run(
      `INSERT INTO master_products(code,name,source_kind,origin_kind,inventory_eligible,created_at,updated_at)
      VALUES ${codes.map(() => "(?,?,'erp-product','legacy',1,'2026-11-01','2026-11-01')").join(',')}`,
      codes.flatMap((code) => [code, '列表验收腈纶长规格名称 ' + code.slice(-6)]),
    );
    await db.run(
      `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
      VALUES ${codes.map(() => "('DEMO-WH',?,2,'0.6000')").join(',')}`,
      codes,
    );
  }
}

function timedWriter(writer: XlsxWriter) {
  const time = { appendMs: 0, finishMs: 0 };
  const wrapped: ExportWriter = {
    append: (row) => {
      const start = performance.now();
      const result = writer.append(row);
      time.appendMs += performance.now() - start;
      return result;
    },
    totals: () => writer.totals(),
    drain: () => writer.drain(),
    abort: () => writer.abort(),
    finish: async (count, report) => {
      const start = performance.now();
      await writer.finish(count, report);
      time.finishMs = performance.now() - start;
    },
  };
  return { time, wrapped };
}

export async function diagnoseStock(db: Database) {
  await stockFixture(db);
  const query = { source: 'erp-product', product: 'WL-P', sortBy: 'productCode', direction: 'asc', pageSize: '20' };
  const page = await exportReader('stock', query)(db);
  assert.equal(page.total, 100_000);
  const request: ExportRequest = {
    requestId: randomUUID(),
    kind: 'stock',
    scope: 'all',
    schema: 'document_summary',
    format: 'xlsx',
    query,
    columns: listFields.stock.map((f) => f.key),
    viewToken: page.viewToken,
    selected: [],
  };
  const filename = `.local/evidence/b6b-step5/stock-diagnostic-${request.requestId}.xlsx`;
  const writer = new XlsxWriter({ filename, kind: 'stock', fields: listFields.stock });
  const { time, wrapped } = timedWriter(writer);
  const sql = measurement();
  const job = newExportJob(request);
  const start = performance.now();
  await probe.run(sql, () =>
    generateSnapshot(db, { request, job, writer: wrapped, cancelled: () => false, hooks: {} }),
  );
  const elapsedMs = performance.now() - start;
  const batches = sql.queries.filter((q) => q.sql.includes('LIMIT ? OFFSET ?'));
  const first = batches.find((q) => q.values?.at(-2) === 1000)!;
  const last = batches.at(-1)!;
  const explain = await db.all('EXPLAIN ' + last.sql, last.values);
  const analyze = await db.all('EXPLAIN ANALYZE ' + last.sql, last.values);
  const result = {
    database: String((await db.get('SELECT DATABASE() AS name'))?.name),
    filename,
    elapsedMs,
    sqlMs: sql.sqlMs,
    ...time,
    rows: job.processed,
    bytes: (await stat(filename)).size,
    pageQueries: batches.length,
    firstBatchMs: first.ms,
    lastBatchMs: last.ms,
    lastOffset: last.values?.at(-1),
    sql,
    explain,
    analyze,
  };
  assert.equal(job.processed, 100_000);
  console.log(
    'B6B_STEP5_STOCK ' +
      JSON.stringify({
        elapsedMs,
        sqlMs: sql.sqlMs,
        ...time,
        rows: job.processed,
        firstBatchMs: first.ms,
        lastBatchMs: last.ms,
        lastOffset: last.values?.at(-1),
      }),
  );
  return result;
}
