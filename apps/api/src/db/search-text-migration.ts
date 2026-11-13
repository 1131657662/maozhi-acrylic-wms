import type { Database } from './mysql.ts';
import { SEARCH_TEXT_TARGETS } from '../features/master-data/search-text.ts';

export async function guardSearchTextDown(db: Database): Promise<void> {
  for (const { table, key } of Object.values(SEARCH_TEXT_TARGETS)) {
    if (await db.get(`SELECT ${key} FROM ${table} WHERE search_text IS NOT NULL LIMIT 1`))
      throw new Error(`拒绝回退：${table}.search_text 已有数据，禁止删除`);
  }
}
