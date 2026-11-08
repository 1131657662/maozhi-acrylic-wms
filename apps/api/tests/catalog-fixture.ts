import { randomUUID } from 'node:crypto';
import { fixture, actor, fact } from './fixture.ts';
import { uploadCatalog } from '../src/features/catalog/upload.ts';
import { publishCatalog } from '../src/features/catalog/publish.ts';
import { readEntries, getVersion } from '../src/features/catalog/repository.ts';
import { contentHash, bytesHash } from '../src/features/catalog/hash.ts';
import type { Database } from '../src/db/mysql.ts';

export { actor, fact };
export async function catalogFixture() {
  return fixture();
}
export async function upload(db: Database, text: string, rebuildOfVersionId?: number) {
  return uploadCatalog(db, {
    bytes: Buffer.from(text),
    encoding: 'utf-8',
    fileName: 'sku.txt',
    key: randomUUID(),
    actor,
    ...(rebuildOfVersionId ? { rebuildOfVersionId } : {}),
  });
}
export async function publish(db: Database, id: number) {
  const version = await getVersion(db, id);
  return publishCatalog(db, {
    versionId: id,
    baseRevision: version.baseRevision,
    contentSha256: version.contentSha256,
    key: randomUUID(),
    actor,
    enabled: true,
  });
}
export async function catalogSnapshot(db: Database) {
  const tables = [
    'catalog_versions',
    'catalog_entries',
    'catalog_head',
    'scan_facts',
    'scan_fact_context',
    'scan_submissions',
    'outbound_orders',
    'stock',
    'stock_journal',
    'operation_log',
    'idempotent_commands',
  ];
  const result: Record<string, unknown> = {};
  for (const table of tables)
    result[table] = (await db.all(`SELECT * FROM ${table}`)).map((r) => JSON.stringify(r)).sort();
  return result;
}
// Only disposable synthetic fixture preparation; never available from business routes or the sample seed.
export async function addV1Fixture(db: Database, entry: { barcode: string; product: string; tonnes: string }) {
  if (!/^maozhi_test_[a-f0-9]+$/.test(String((await db.get('SELECT DATABASE() AS n'))?.n)))
    throw new Error('Disposable test database required');
  await db.run(
    `INSERT INTO catalog_entries(version_id,barcode,legacy_product_code,source_spec,raw_weight_kg,weight_tonnes) VALUES(1,?,?,'合成规格',CAST(?*1000 AS CHAR),?)`,
    [entry.barcode, entry.product, entry.tonnes, entry.tonnes],
  );
  const entries = await readEntries(db, 1),
    bytes = Buffer.from(JSON.stringify(entries));
  await db.run(
    'UPDATE catalog_versions SET entry_count=?,spec_count=?,content_sha256=?,source_sha256=?,source_bytes=? WHERE version_id=1',
    [entries.length, new Set(entries.map((e) => e.sourceSpec)).size, contentHash(entries), bytesHash(bytes), bytes],
  );
}
