import {
  CATALOG_READ_BATCH_SIZE,
  WEB_EXPORT_MAX_ROWS,
  catalogExportCopy,
  type CatalogExportQuery,
} from '@wms/contracts';
import type { Response } from 'express';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { head, entryRow } from './repository.ts';
import { XlsxWriter } from '../web-exports/writer.ts';
import type { XlsxField } from '../web-exports/xlsx-config.ts';

const fields: XlsxField[] = [
  { key: 'barcode', label: catalogExportCopy.barcode, width: 28, type: 'text' },
  { key: 'sourceSpec', label: catalogExportCopy.spec, width: 48, type: 'text' },
  { key: 'weightGrams', label: catalogExportCopy.weight, width: 20, type: 'kilograms', total: false },
  { key: 'version', label: catalogExportCopy.version, width: 16, type: 'text' },
];
export function catalogSearchFilter(query: string) {
  const clause = query ? " AND (barcode LIKE ? ESCAPE '!' OR source_spec LIKE ? ESCAPE '!')" : '';
  const pattern = `%${query.replace(/[!%_]/g, (character) => `!${character}`)}%`;
  return { clause, params: query ? [pattern, pattern] : [] };
}
export function assertCatalogExportLimit(count: number): void {
  if (count > WEB_EXPORT_MAX_ROWS)
    throw new AppError('EXPORT_TOO_LARGE', '超过单文件 100,000 行，请缩小搜索或筛选条件', 422);
}
async function appendCatalog(db: Database, writer: XlsxWriter, input: CatalogExportQuery): Promise<number> {
  const filter = catalogSearchFilter(input.q);
  let after = '',
    processed = 0;
  while (true) {
    const rows = await db.all(
      `SELECT * FROM catalog_entries WHERE version_id=?${filter.clause}
      AND barcode>? ORDER BY barcode LIMIT ?`,
      [input.versionId, ...filter.params, after, CATALOG_READ_BATCH_SIZE],
    );
    if (!rows.length) return processed;
    for (const row of rows) {
      const entry = entryRow(row);
      writer.append({
        ...entry,
        sourceSpec: entry.sourceSpec ?? catalogExportCopy.noSpec,
        version: catalogExportCopy.versionLabel(input.versionId),
      });
      after = entry.barcode;
      processed++;
    }
    await writer.drain();
  }
}
export async function exportCatalog(db: Database, input: CatalogExportQuery, response: Response): Promise<void> {
  await db.readSnapshot(async (tx) => {
    const current = await head(tx);
    if (current?.versionId !== input.versionId)
      throw new AppError('EXPORT_VIEW_CHANGED', '目录版本已变化，请刷新后重新导出', 409);
    const filter = catalogSearchFilter(input.q);
    const count = Number(
      (
        await tx.get(`SELECT COUNT(*) AS n FROM catalog_entries WHERE version_id=?${filter.clause}`, [
          input.versionId,
          ...filter.params,
        ])
      )?.n ?? 0,
    );
    assertCatalogExportLimit(count);
    response.set('Cache-Control', 'private, no-store');
    response.attachment(`catalog-v${input.versionId}.xlsx`);
    const writer = new XlsxWriter({ stream: response, fields });
    try {
      await writer.finish(await appendCatalog(tx, writer, input));
    } catch (error) {
      await writer.abort();
      throw error;
    }
  });
}
