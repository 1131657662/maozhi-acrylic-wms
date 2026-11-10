import assert from 'node:assert/strict';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { seedListEvidence } from '../e2e-list-fixtures.ts';

export const DOCUMENTS = 10_000;
export const LINES = 100_000;
const BATCH = 500;

export async function seedPerformanceLines(db: Database) {
  await seedListEvidence(db, DOCUMENTS);
  for (let start = 0; start < DOCUMENTS; start += BATCH) {
    const rows = Array.from({ length: BATCH }, (_, index) => String(start + index).padStart(6, '0'));
    for (const kind of ['inbound', 'outbound'] as const) await appendLines(db, kind, rows);
  }
  const counts = [];
  for (const kind of ['inbound', 'outbound'] as const) {
    const parent = kind === 'inbound' ? 'receipt_id' : 'order_id';
    const result = await db.get(`SELECT COUNT(*) AS lineCount,COUNT(DISTINCT ${parent}) AS documents
      FROM ${kind}_lines WHERE source_del_flag=0 AND product_code LIKE 'WL-P%'`);
    assert.equal(Number(result?.lineCount), LINES);
    assert.equal(Number(result?.documents), DOCUMENTS);
    counts.push({ kind, documents: Number(result?.documents), lines: Number(result?.lineCount) });
  }
  return counts;
}

async function appendLines(db: Database, kind: 'inbound' | 'outbound', numbers: string[]) {
  const rows = numbers.flatMap((n) =>
    Array.from({ length: 8 }, (_, line) => [
      `B6B-${kind}-${n}-${line}`,
      `WL-${kind === 'inbound' ? 'R' : 'O'}${n}`,
      line === 0 ? 'WL-P000130' : 'WL-P' + n,
      1,
      '0.3000',
      0,
    ]),
  );
  const columns =
    kind === 'inbound'
      ? 'receipt_id,product_code,packages,weight_tonnes'
      : 'order_id,product_code,planned_packages,planned_weight_tonnes';
  const names = kind === 'outbound' ? ',product_name' : '';
  const values = kind === 'outbound' ? rows.map((row) => [...row, '性能验收腈纶']) : rows;
  await db.run(
    `INSERT INTO ${kind}_lines(id,${columns},source_del_flag${names})
    VALUES ${values.map((row) => '(' + row.map(() => '?').join(',') + ')').join(',')}`,
    values.flat(),
  );
}
