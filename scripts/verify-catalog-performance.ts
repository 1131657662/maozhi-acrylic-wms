import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { uploadCatalog } from '../apps/api/src/features/catalog/upload.ts';
import { publishCatalog } from '../apps/api/src/features/catalog/publish.ts';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('提供本地 sku.txt 路径；只向随机临时库写入');
const bytes = readFileSync(inputPath), actor = { username: 'owner', traceId: 'catalog-perf-isolated' };
const { db, dispose } = await createTestDatabase();
const uploads: number[] = [], publications: number[] = [];
try {
  await seedDemo(db, 'performance-test-only');
  for (let index = 0; index < 20; index++) {
    let start = performance.now();
    const result = await uploadCatalog(db, { bytes, encoding: 'gb18030', fileName: 'sku.txt', key: randomUUID(), actor, ...(index ? { rebuildOfVersionId: 2 } : {}) });
    uploads.push(performance.now() - start);
    assert.equal(result.version?.entryCount, 9018); const version = result.version!;
    start = performance.now();
    await publishCatalog(db, { versionId: version.versionId, baseRevision: version.baseRevision, contentSha256: version.contentSha256, key: randomUUID(), actor, enabled: true });
    publications.push(performance.now() - start);
  }
  const p95 = (values: number[]) => Number([...values].sort((a,b) => a-b)[Math.ceil(values.length*0.95)-1]!.toFixed(2));
  console.log(JSON.stringify({ rows: 9018, runs: 20, mysqlPort: 3307, uploadParseDiffCommitP95Ms: p95(uploads), publishTransactionP95Ms: p95(publications), uploadMs: uploads.map(n => Number(n.toFixed(2))), publishMs: publications.map(n => Number(n.toFixed(2))) }));
} finally { await dispose(); }
