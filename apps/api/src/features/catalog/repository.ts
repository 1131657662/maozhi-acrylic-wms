import { catalogVersionSchema, type CatalogVersion } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogEntry } from './hash.ts';
import { isoDate } from '../../db/dates.ts';

const versionFields = `v.version_id AS versionId,v.upload_uuid AS uploadId,
 CASE WHEN a.version_id IS NOT NULL THEN 'abandoned' ELSE v.status END AS status,
 v.base_version_id AS baseVersionId,v.base_revision AS baseRevision,
 v.content_sha256 AS contentSha256,v.source_sha256 AS sourceSha256,v.entry_count AS entryCount,v.spec_count AS specCount,
 v.source_name AS sourceName,v.created_at AS createdAt,v.published_at AS publishedAt,v.diff_json,
 a.reason AS abandonReason,a.actor AS abandonActor,a.created_at AS abandonedAt`;
const versionSource = 'catalog_versions v LEFT JOIN catalog_candidate_abandons a ON a.version_id=v.version_id';
export function versionRow(row: Row): CatalogVersion {
  return catalogVersionSchema.parse({
    ...row,
    diffCounts: JSON.parse(String(row.diff_json)),
    abandonment:
      row.abandonedAt == null
        ? null
        : {
            reason: row.abandonReason,
            actor: row.abandonActor,
            createdAt: isoDate(row.abandonedAt),
          },
  });
}
export async function getVersion(db: Database, id: number): Promise<CatalogVersion> {
  const row = await db.get(
    `SELECT ${versionFields} FROM ${versionSource} WHERE v.version_id=? AND v.status<>'staging'`,
    [id],
  );
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
    `SELECT ${versionFields} FROM ${versionSource} WHERE v.status<>'staging' ORDER BY v.version_id DESC LIMIT 20 OFFSET ?`,
    [(page - 1) * 20],
  );
  return { items: rows.map(versionRow), total };
}
