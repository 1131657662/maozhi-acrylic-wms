import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fixture, actor } from '../apps/api/tests/fixture.ts';
import { seedStocktakeVolume } from '../apps/api/tests/stocktake-volume-fixture.ts';
import { injectStocktakeFailure } from '../apps/api/tests/stocktake-fixture.ts';
import { businessFingerprint } from '../apps/api/tests/lifecycle-fixture.ts';
import { createStocktake } from '../apps/api/src/features/stocktake/create.ts';
import { saveReading } from '../apps/api/src/features/stocktake/save-reading.ts';
import { stocktakePreview } from '../apps/api/src/features/stocktake/preview.ts';
import { postStocktake } from '../apps/api/src/features/stocktake/post.ts';
import { stocktakeLines } from '../apps/api/src/features/stocktake/read-model.ts';
import { stocktakeQuerySchema } from '@wms/contracts';
import { createInbound } from '../apps/api/src/features/inbound/create.ts';
import { confirmInbound } from '../apps/api/src/features/inbound/confirm.ts';
import { newReceipt } from '../apps/api/tests/numbering-fixture.ts';

const { db, dispose } = await fixture(),
  durations: Record<string, number> = {};
async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  durations[name] = Math.round(performance.now() - start);
  return result;
}
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]!;
mkdirSync('.local/evidence', { recursive: true });
try {
  await seedStocktakeVolume(db);
  const take = await timed('snapshot_ms', () =>
    createStocktake(db, { warehouseCode: 'COUNT-WH' }, randomUUID(), actor),
  );
  assert.equal(take.lineCount, 10000);
  const saveTimes: number[] = [],
    pageTimes: number[] = [];
  for (let n = 1; n <= 30; n++) {
    const start = performance.now();
    await saveReading(db, {
      id: take.id,
      productCode: `COUNT-${String(n).padStart(5, '0')}`,
      input: { expectedRevision: 0, actual: { packages: 1, weightGrams: 300100 } },
      key: randomUUID(),
      actor,
    });
    saveTimes.push(performance.now() - start);
    const load = performance.now();
    const page = await stocktakeLines(db, take.id, stocktakeQuerySchema.parse({ page: n, pageSize: 200 }));
    pageTimes.push(performance.now() - load);
    assert.equal(page.items.length, 200);
  }
  // Remaining values are synthetic measurement fixtures, not an undisclosed bulk-entry product feature.
  await db.run(
    `UPDATE stocktake_readings SET packages=1,weight_tonnes='0.3001' WHERE stocktake_id=? AND packages IS NULL`,
    [take.id],
  );
  const preview = await timed('preview_ms', () => stocktakePreview(db, take.id));
  const command = {
    id: take.id,
    input: { expectedToken: preview.token, reason: '万行合成差异验收', acknowledgeSnapshotBasis: false },
    key: randomUUID(),
    actor,
  };
  const before = await businessFingerprint(db);
  await injectStocktakeFailure(db, 'stock_journal', 'INSERT', "NEW.product_code='COUNT-00501'");
  try {
    await assert.rejects(postStocktake(db, command), /injected/);
    assert.deepEqual(await businessFingerprint(db), before);
    console.log('B3A_VOLUME second_batch_failure_at=501 partial_writes=0 prior_batch_rolled_back=true');
  } finally {
    await db.run('DROP TRIGGER b3a_fail');
  }
  const other = await createInbound(db, newReceipt(), randomUUID(), actor),
    rss = process.memoryUsage().rss;
  const [completed] = await Promise.all([
    timed('post_10000_ms', () => postStocktake(db, command)),
    timed('other_warehouse_confirm_wait_ms', () => confirmInbound(db, other.id, randomUUID(), actor)),
  ]);
  assert.equal(completed.snapshotHash, take.snapshotHash);
  assert.equal(completed.changedCount, 10000);
  const results = [];
  for (const query of readFileSync('scripts/sql/verify-stocktake.sql', 'utf8')
    .replace(/^--.*$/gm, '')
    .split(';')
    .filter((s) => s.trim())) {
    const rows = await db.all(query);
    assert(rows.every((r) => ('balanced' in r ? Number(r.balanced) === 1 : Number(r.mismatches) === 0)));
    results.push(rows);
  }
  const evidence = {
    ...durations,
    save_row_p95_ms: Math.round(p95(saveTimes)),
    page_200_p95_ms: Math.round(p95(pageTimes)),
    rss_before_mib: Math.round(rss / 1048576),
    rss_after_mib: Math.round(process.memoryUsage().rss / 1048576),
    rows: results[0]!.length,
    mismatches: 0,
    last: results[0]!.at(-1),
  };
  assert.equal(evidence.rows, 10000);
  writeFileSync('.local/evidence/b3a-volume-sql.json', JSON.stringify(results, null, 2));
  writeFileSync('.local/evidence/b3a-volume-metrics.json', JSON.stringify(evidence, null, 2));
  console.log(`B3A_VOLUME ${JSON.stringify(evidence)}`);
  console.log(
    'B3A_EXPLAIN ' +
      JSON.stringify(
        await db.all('EXPLAIN SELECT * FROM stocktake_snapshots WHERE stocktake_id=? ORDER BY product_code LIMIT 200', [
          take.id,
        ]),
      ),
  );
} finally {
  await dispose();
}
