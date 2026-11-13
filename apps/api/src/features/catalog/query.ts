import {
  catalogBarcodeTraceResultSchema,
  catalogLookupResultSchema,
  catalogSearchResultSchema,
  catalogSpecSummaryResultSchema,
  type CatalogSearchQuery,
} from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { entryRow, head } from './repository.ts';

export async function searchCatalog(db: Database, query: CatalogSearchQuery) {
  return db.readSnapshot(async (tx) => {
    const version = await currentVersion(tx);
    if (!version) return catalogSearchResultSchema.parse({ version, items: [], total: 0, ...query });
    const filter = query.q ? " AND (barcode LIKE ? ESCAPE '!' OR source_spec LIKE ? ESCAPE '!')" : '';
    const pattern = `%${escapeLike(query.q)}%`;
    const params = query.q ? [version.versionId, pattern, pattern] : [version.versionId];
    const where = `version_id=?${filter}`;
    const count = await tx.get(`SELECT COUNT(*) AS total FROM catalog_entries WHERE ${where}`, params);
    const rows = await tx.all(`SELECT * FROM catalog_entries WHERE ${where} ORDER BY barcode LIMIT ? OFFSET ?`, [
      ...params,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    ]);
    return catalogSearchResultSchema.parse({
      version,
      items: rows.map((row) => {
        const entry = entryRow(row);
        return { barcode: entry.barcode, sourceSpec: entry.sourceSpec, weightGrams: entry.weightGrams };
      }),
      total: integerValue(count?.total),
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}

export async function summarizeCatalogSpecs(db: Database) {
  return db.readSnapshot(async (tx) => {
    const version = await currentVersion(tx);
    if (!version) return catalogSpecSummaryResultSchema.parse({ version, items: [] });
    const rows = await tx.all(
      `SELECT source_spec AS sourceSpec,COUNT(*) AS barcodeCount,
      CAST(ROUND(SUM(weight_tonnes)*1000000,0) AS CHAR) AS totalWeightGrams,
      CAST(ROUND(MIN(weight_tonnes)*1000000,0) AS CHAR) AS minWeightGrams,
      CAST(ROUND(MAX(weight_tonnes)*1000000,0) AS CHAR) AS maxWeightGrams,
      CAST(ROUND(AVG(weight_tonnes)*1000000,0) AS CHAR) AS averageWeightGrams
      FROM catalog_entries WHERE version_id=? GROUP BY source_spec ORDER BY source_spec`,
      [version.versionId],
    );
    return catalogSpecSummaryResultSchema.parse({ version, items: rows.map(summaryRow) });
  });
}

export async function traceCatalogBarcode(db: Database, barcode: string) {
  return db.readSnapshot(async (tx) => {
    const rows = await tx.all(
      `SELECT e.*,CASE WHEN a.version_id IS NOT NULL THEN 'abandoned' ELSE v.status END AS status,
      v.created_at AS createdAt,v.published_at AS publishedAt
      FROM catalog_entries e INNER JOIN catalog_versions v ON v.version_id=e.version_id
      LEFT JOIN catalog_candidate_abandons a ON a.version_id=v.version_id
      WHERE e.barcode=? AND v.status IN ('validated','published') ORDER BY e.version_id`,
      [barcode],
    );
    const versions = rows.map(traceRow);
    return catalogBarcodeTraceResultSchema.parse({
      barcode,
      versions,
      firstVersionId: versions[0]?.versionId ?? null,
      lastVersionId: versions.at(-1)?.versionId ?? null,
    });
  });
}

export async function lookupCatalogBarcode(db: Database, barcode: string) {
  return db.readSnapshot(async (tx) => {
    const version = await currentVersion(tx);
    if (!version) return catalogLookupResultSchema.parse({ found: false, barcode, version, entry: null });
    const row = await tx.get('SELECT * FROM catalog_entries WHERE version_id=? AND barcode=?', [
      version.versionId,
      barcode,
    ]);
    if (!row) return catalogLookupResultSchema.parse({ found: false, barcode, version, entry: null });
    const entry = entryRow(row);
    return catalogLookupResultSchema.parse({
      found: true,
      barcode,
      version,
      entry: { sourceSpec: entry.sourceSpec, weightGrams: entry.weightGrams },
    });
  });
}

async function currentVersion(db: Database) {
  const active = await head(db);
  return active ? { versionId: active.versionId, status: 'published' as const, revision: active.revision } : null;
}

function summaryRow(row: Row) {
  return {
    sourceSpec: row.sourceSpec === null ? null : String(row.sourceSpec),
    barcodeCount: integerValue(row.barcodeCount),
    totalWeightGrams: integerValue(row.totalWeightGrams),
    minWeightGrams: integerValue(row.minWeightGrams),
    maxWeightGrams: integerValue(row.maxWeightGrams),
    averageWeightGrams: integerValue(row.averageWeightGrams),
  };
}

function traceRow(row: Row) {
  const entry = entryRow(row);
  return {
    versionId: Number(row.version_id),
    status: row.status,
    sourceSpec: entry.sourceSpec,
    weightGrams: entry.weightGrams,
    createdAt: String(row.createdAt),
    publishedAt: row.publishedAt === null ? null : String(row.publishedAt),
  };
}

function integerValue(value: unknown): number {
  const text = String(value ?? '0');
  if (!/^\d+$/.test(text)) throw new Error('目录统计必须为非负整数');
  const result = Number(text);
  if (!Number.isSafeInteger(result)) throw new Error('目录统计超出安全整数范围');
  return result;
}

function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}
