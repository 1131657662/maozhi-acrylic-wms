import {
  masterItemSchema,
  masterListQuerySchema,
  masterPageSchema,
  type MasterCatalog,
  type MasterListQuery,
} from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { catalogTable } from './catalogs.ts';

function sourcePredicate(catalog: MasterCatalog): string {
  return `source_del_flag=0${catalog === 'products' ? " AND source_kind='erp-product'" : ''}`;
}
function predicate(catalog: MasterCatalog, query: MasterListQuery) {
  const clauses = [sourcePredicate(catalog)],
    values: string[] = [];
  if (query.keyword) {
    clauses.push("(code LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')");
    const keyword = `%${query.keyword.replace(/[!%_]/g, '!$&')}%`;
    values.push(keyword, keyword);
  }
  if (query.status !== 'all') clauses.push(`active=${query.status === 'active' ? 1 : 0}`);
  return { sql: clauses.join(' AND '), values };
}
function item(row: Row) {
  return masterItemSchema.parse({ ...row, active: Number(row.active) === 1 });
}
export async function listMasterItems(db: Database, catalog: MasterCatalog, input: unknown = {}) {
  const query = masterListQuerySchema.parse(input),
    filter = predicate(catalog, query),
    table = catalogTable(catalog);
  return db.readSnapshot(async (tx) => {
    const total = Number((await tx.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${filter.sql}`, filter.values))?.n);
    const rows = await tx.all(
      `SELECT code,name,active FROM ${table} WHERE ${filter.sql} ORDER BY code LIMIT ? OFFSET ?`,
      [...filter.values, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return masterPageSchema.parse({ items: rows.map(item), total, page: query.page, pageSize: query.pageSize });
  });
}
export async function readMasterItem(db: Database, catalog: MasterCatalog, code: string) {
  const row = await db.get(
    `SELECT code,name,active FROM ${catalogTable(catalog)} WHERE code=? AND ${sourcePredicate(catalog)}`,
    [code],
  );
  if (!row) throw new AppError('NOT_FOUND', '资料不存在或不属于可用的 ERP 商品目录', 404);
  return item(row);
}
