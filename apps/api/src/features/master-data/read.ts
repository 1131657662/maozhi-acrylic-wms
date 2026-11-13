import { masterListQuerySchema, masterPageSchema, type MasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { catalogTable } from './catalogs.ts';
import { masterItem } from './fields.ts';
import { partyProjection } from './party-projection.ts';
import { masterListPredicate } from './search-query.ts';

function sourcePredicate(catalog: MasterCatalog): string {
  return `source_del_flag=0${catalog === 'products' ? " AND source_kind<>'sku-spec'" : ''}`;
}
export async function listMasterItems(db: Database, catalog: MasterCatalog, input: unknown = {}) {
  const query = masterListQuerySchema.parse(input),
    filter = masterListPredicate(catalog, query),
    table = catalogTable(catalog);
  return db.readSnapshot(async (tx) => {
    const total = Number((await tx.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${filter.sql}`, filter.values))?.n);
    const rows = await tx.all(`SELECT * FROM ${table} WHERE ${filter.sql} ORDER BY code LIMIT ? OFFSET ?`, [
      ...filter.values,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    ]);
    return masterPageSchema.parse({
      items: await partyProjection(
        tx,
        catalog,
        rows.map((row) => masterItem(row, catalog)),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}
export async function readMasterItem(db: Database, catalog: MasterCatalog, code: string) {
  const row = await db.get(`SELECT * FROM ${catalogTable(catalog)} WHERE code=? AND ${sourcePredicate(catalog)}`, [
    code,
  ]);
  if (!row) throw new AppError('NOT_FOUND', '资料不存在', 404);
  return (await partyProjection(db, catalog, [masterItem(row, catalog)]))[0]!;
}
