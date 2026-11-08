import { catalogVersionSchema, type CatalogVersion } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogEntry } from './hash.ts';

const versionFields = `version_id AS versionId,upload_uuid AS uploadId,status,base_version_id AS baseVersionId,base_revision AS baseRevision,
 content_sha256 AS contentSha256,source_sha256 AS sourceSha256,entry_count AS entryCount,spec_count AS specCount,
 source_name AS sourceName,created_at AS createdAt,published_at AS publishedAt,diff_json`;
export function versionRow(row: Row): CatalogVersion {
  return catalogVersionSchema.parse({ ...row, diffCounts: JSON.parse(String(row.diff_json)) });
}
export async function getVersion(db: Database, id: number): Promise<CatalogVersion> {
  const row = await db.get(`SELECT ${versionFields} FROM catalog_versions WHERE version_id=? AND status<>'staging'`, [
    id,
  ]);
  if (!row) throw new AppError('CATALOG_VERSION_UNAVAILABLE', '目录版本不存在或尚未校验', 409);
  return versionRow(row);
}
export async function readEntries(db: Database, id: number): Promise<CatalogEntry[]> {
  return (await db.all('SELECT * FROM catalog_entries WHERE version_id=? ORDER BY barcode', [id])).map(entryRow);
}
export function entryRow(row: Row): CatalogEntry {
  return {
    barcode: String(row.barcode),
    sourceSpec: row.source_spec === null ? null : String(row.source_spec),
    rawWeightKg: String(row.raw_weight_kg),
    weightGrams: decimalToGrams(row.weight_tonnes),
    legacyProductCode: row.legacy_product_code === null ? null : String(row.legacy_product_code),
  };
}
export async function insertEntries(db: Database, id: number, entries: CatalogEntry[]): Promise<void> {
  for (let offset = 0; offset < entries.length; offset += 250) {
    const batch = entries.slice(offset, offset + 250);
    await db.run(
      `INSERT INTO catalog_entries(version_id,barcode,source_spec,raw_weight_kg,weight_tonnes,legacy_product_code)
      VALUES ${batch.map(() => '(?,?,?,?,?,?)').join(',')}`,
      batch.flatMap((e) => [
        id,
        e.barcode,
        e.sourceSpec,
        e.rawWeightKg,
        gramsToDecimal(e.weightGrams),
        e.legacyProductCode,
      ]),
    );
  }
}
export async function head(db: Database): Promise<{ versionId: number; revision: number } | null> {
  const row = await db.get('SELECT active_version_id,revision FROM catalog_head WHERE id=1');
  return row ? { versionId: Number(row.active_version_id), revision: Number(row.revision) } : null;
}
export async function history(db: Database, page: number) {
  const total = Number((await db.get("SELECT COUNT(*) AS n FROM catalog_versions WHERE status<>'staging'"))?.n ?? 0);
  const rows = await db.all(
    `SELECT ${versionFields} FROM catalog_versions WHERE status<>'staging' ORDER BY version_id DESC LIMIT 20 OFFSET ?`,
    [(page - 1) * 20],
  );
  return { items: rows.map(versionRow), total };
}
