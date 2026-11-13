import type { Database } from '../../db/mysql.ts';
import { buildMasterSearchText, hasSearchText, SEARCH_TEXT_TARGETS } from './search-text.ts';

// The caller owns the master-data/document transaction and has locked the row.
export async function refreshMasterSearchText(db: Database, catalog: string, key: string): Promise<void> {
  if (!hasSearchText(catalog)) return;
  const target = SEARCH_TEXT_TARGETS[catalog];
  const row = await db.get(`SELECT * FROM ${target.table} WHERE ${target.key}=?`, [key]);
  if (!row) throw new Error('检索内容对应资料不存在');
  await db.run(`UPDATE ${target.table} SET search_text=? WHERE ${target.key}=?`, [
    buildMasterSearchText(catalog, row),
    key,
  ]);
}
