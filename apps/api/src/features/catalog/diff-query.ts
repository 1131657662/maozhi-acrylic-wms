import { catalogDiffRowSchema, type CatalogDiffQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';

const weightChanged = '(o.barcode IS NOT NULL AND n.barcode IS NOT NULL AND o.weight_tonnes<>n.weight_tonnes)';
const specChanged =
  '(o.barcode IS NOT NULL AND n.barcode IS NOT NULL AND NOT (CAST(o.source_spec AS BINARY)<=>CAST(n.source_spec AS BINARY)))';
const fields = `COALESCE(o.barcode,n.barcode) AS barcode,o.source_spec AS oldSpec,n.source_spec AS newSpec,
 o.weight_tonnes AS oldWeight,n.weight_tonnes AS newWeight,${weightChanged} AS weightChanged,${specChanged} AS specChanged,
 CASE WHEN o.barcode IS NULL THEN 'added' WHEN n.barcode IS NULL THEN 'removed'
 WHEN ${weightChanged} OR ${specChanged} THEN 'changed' ELSE 'unchanged' END AS kind`;
const union = `SELECT ${fields} FROM catalog_entries o LEFT JOIN catalog_entries n
 ON n.version_id=? AND n.barcode=o.barcode WHERE o.version_id=?
 UNION ALL SELECT ${fields} FROM catalog_entries n LEFT JOIN catalog_entries o
 ON o.version_id=? AND o.barcode=n.barcode WHERE n.version_id=? AND o.barcode IS NULL`;

async function comparableVersion(db: Database, id: number): Promise<Row> {
  const row = await db.get('SELECT version_id,base_version_id,status FROM catalog_versions WHERE version_id=?', [id]);
  if (!row) throw new AppError('NOT_FOUND', '目录版本不存在', 404);
  if (!['validated', 'published'].includes(String(row.status)))
    throw new AppError('CATALOG_VERSION_UNAVAILABLE', '目录版本尚未通过校验，不能对比', 422);
  return row;
}
function diffFilter(kind: CatalogDiffQuery['kind']): string {
  if (kind === 'all') return '1=1';
  if (kind === 'weight') return 'weightChanged=1';
  if (kind === 'spec') return 'specChanged=1';
  return 'kind=?';
}
function diffRow(row: Row) {
  return catalogDiffRowSchema.parse({
    ...row,
    oldWeightGrams: row.oldWeight == null ? null : decimalToGrams(row.oldWeight),
    newWeightGrams: row.newWeight == null ? null : decimalToGrams(row.newWeight),
    weightChanged: Boolean(Number(row.weightChanged)),
    specChanged: Boolean(Number(row.specChanged)),
  });
}
export async function queryVersionDiff(db: Database, input: CatalogDiffQuery & { versionId: number }) {
  return db.readSnapshot(async (tx) => {
    const version = await comparableVersion(tx, input.versionId);
    const baseVersionId = input.against ?? (version.base_version_id == null ? null : Number(version.base_version_id));
    if (baseVersionId !== null) await comparableVersion(tx, baseVersionId);
    const params = [input.versionId, baseVersionId, baseVersionId, input.versionId];
    const filter = diffFilter(input.kind);
    const values = ['all', 'weight', 'spec'].includes(input.kind) ? params : [...params, input.kind];
    const count = await tx.get(`SELECT COUNT(*) AS n FROM (${union}) d WHERE ${filter}`, values);
    const rows = await tx.all(`SELECT * FROM (${union}) d WHERE ${filter} AND barcode>? ORDER BY barcode LIMIT ?`, [
      ...values,
      input.afterBarcode,
      input.limit,
    ]);
    return { items: rows.map(diffRow), total: Number(count?.n ?? 0), baseVersionId };
  });
}
