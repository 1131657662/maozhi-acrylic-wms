import assert from 'node:assert/strict';
import { randomInt, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { reportQuerySchema, reportMonthlySchema, reportDetailsSchema } from '@wms/contracts';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedFromSamples } from '../apps/api/src/db/seed.ts';
import { readSampleCsv } from '../apps/api/src/db/sample-reader.ts';
import { readReport } from '../apps/api/src/features/reports/read.ts';
import { decimalToGrams } from '../apps/api/src/db/weight.ts';

const sample = readSampleCsv('stock_journal'),
  candidates = [...new Set(sample.filter((r) => r.del_flag === '0').map((r) => r.create_time!.slice(0, 7)))];
const requested = process.argv
  .find((arg) => arg.startsWith('--months='))
  ?.slice('--months='.length)
  .split(',');
if (requested)
  assert.ok(
    requested.length === 3 && new Set(requested).size === 3 && requested.every((m) => candidates.includes(m)),
    '请选择样本中三个不同月份',
  );
const months: string[] = requested ?? [];
while (months.length < 3) months.push(...candidates.splice(randomInt(candidates.length), 1));
months.sort();
const fixture = await createTestDatabase(),
  sql = readFileSync('scripts/report-reconciliation.sql', 'utf8'),
  results: unknown[] = [];
mkdirSync('.local/evidence', { recursive: true });
try {
  await seedFromSamples(fixture.db, 'report-sample-verification-only');
  for (const month of months) results.push(await verifyMonth(month));
  const evidence = {
    months,
    sqlHash: createHash('sha256').update(sql).digest('hex'),
    manifestHash: createHash('sha256').update(readFileSync('.local/prod-sample/manifest.json')).digest('hex'),
    results,
  };
  writeFileSync('.local/evidence/b3b-sample-reconciliation.json', JSON.stringify(evidence, null, 2));
  console.log(
    'B3B_SAMPLE_SQL',
    JSON.stringify({
      months,
      results: results.map((r) => {
        const { cells, sqlRows, ...summary } = r as { cells: unknown[]; sqlRows: unknown[] };
        return summary;
      }),
    }),
  );
} finally {
  await fixture.dispose();
}
async function verifyMonth(month: string) {
  const next = new Date(month + '-01T00:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  const query = reportQuerySchema.parse({
    source: 'erp-product',
    fromDay: month + '-01',
    toDay: new Date(next.getTime() - 86400000).toISOString().slice(0, 10),
    pageSize: 200,
  });
  const monthly = reportMonthlySchema.parse(await readReport(fixture.db, 'report-monthly', query));
  const raw = await fixture.db.readSnapshot(async (tx) => {
    await tx.run('SET @report_start=?, @report_end=?', [
      query.fromDay + ' 00:00:00',
      next.toISOString().slice(0, 10) + ' 00:00:00',
    ]);
    return tx.all(sql);
  });
  assert.equal(monthly.total, raw.length);
  assert.equal(monthly.items.length, raw.length);
  const details = [];
  for (let page = 1; ; page++) {
    const batch = reportDetailsSchema.parse(await readReport(fixture.db, 'report-details', { ...query, page }));
    details.push(...batch.items);
    if (details.length >= batch.total) break;
  }
  for (const cell of monthly.items) {
    const row = raw.find((r) => r.warehouse_code === cell.warehouseCode && r.product_code === cell.productCode)!;
    for (const key of ['opening', 'inbound', 'outbound', 'adjustment', 'closing', 'difference'] as const) {
      assert.equal(cell[`${key}Packages`], row[`${key}_packages`] == null ? null : Number(row[`${key}_packages`]));
      assert.equal(cell[`${key}Grams`], row[`${key}_tonnes`] == null ? null : decimalToGrams(row[`${key}_tonnes`]));
    }
    for (const dir of ['inbound', 'outbound'] as const) {
      const selected = details.filter(
        (d) =>
          d.warehouseCode === cell.warehouseCode &&
          d.productCode === cell.productCode &&
          d.directionLabel === (dir === 'inbound' ? '入库' : '出库'),
      );
      assert.equal(
        cell[`${dir}Packages`],
        selected.reduce((s, d) => s + d.packages, 0),
      );
      assert.equal(
        cell[`${dir}Grams`],
        selected.reduce((s, d) => s + d.weightGrams, 0),
      );
    }
    if (cell.differencePackages !== 0 || cell.differenceGrams !== 0)
      assert.ok(cell.checkState === '不可验证' && cell.reasons.length > 0);
  }
  return {
    month,
    cellsChecked: raw.length,
    detailRows: details.length,
    mismatches: 0,
    verified: monthly.items.filter((c) => c.checkState === '可验证').length,
    unverified: monthly.items.filter((c) => c.checkState === '不可验证').length,
    nonzeroOrUnknown: monthly.items.filter((c) => c.differencePackages !== 0 || c.differenceGrams !== 0).length,
    softDeletedExcluded: monthly.report.excludedDeleted,
    cells: monthly.items,
    sqlRows: raw,
  };
}
