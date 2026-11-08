import { randomUUID } from 'node:crypto';
import type { Database } from './mysql.ts';
import { contentHash, bytesHash, type CatalogEntry } from '../features/catalog/hash.ts';
import { insertEntries } from '../features/catalog/repository.ts';
import { catalogDiff, diffCounts } from '../features/catalog/diff.ts';

export async function initializeCatalogV1(db: Database, entries: CatalogEntry[]): Promise<void> {
  const installed = await db.get("SELECT id FROM schema_migrations WHERE id='006_catalog_versioning'");
  if (!installed) {
    await legacySeed(db, entries);
    return;
  }
  const source = Buffer.from(JSON.stringify(entries), 'utf8');
  await db.run(
    `INSERT INTO catalog_versions(version_id,upload_uuid,base_version_id,base_revision,status,source_kind,
    source_name,source_encoding,source_sha256,content_sha256,parser_version,source_bytes,entry_count,spec_count,diff_json,actor,created_at,published_at)
    VALUES(1,?,NULL,0,'published','legacy-db','v1-database-snapshot.json','utf-8',?,?,'legacy-v1',?,?,?,?, 'migration',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
    [
      randomUUID(),
      bytesHash(source),
      contentHash(entries),
      source,
      entries.length,
      new Set(entries.map((e) => e.sourceSpec)).size,
      JSON.stringify(diffCounts(catalogDiff([], entries))),
    ],
  );
  await insertEntries(db, 1, entries);
  await db.run('INSERT INTO catalog_head(id,active_version_id,revision) VALUES(1,1,1)');
}
async function legacySeed(db: Database, entries: CatalogEntry[]): Promise<void> {
  // Only pre-006 fixtures/seeding reach this branch; the 006 read-only view rejects every DML path.
  const { gramsToDecimal } = await import('./weight.ts');
  for (const e of entries)
    await db.run(
      'INSERT INTO scan_catalog(barcode,product_code,weight_tonnes,catalog_version,source_spec) VALUES(?,?,?,1,?)',
      [e.barcode, e.legacyProductCode, gramsToDecimal(e.weightGrams), e.sourceSpec],
    );
}
