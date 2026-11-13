import type { Database } from '../../db/mysql.ts';
import {
  buildMasterSearchText,
  SEARCH_TEXT_BATCH_SIZE,
  SEARCH_TEXT_TARGETS,
  type SearchTextCatalog,
} from './search-text.ts';

async function fillBatch(db: Database, catalog: SearchTextCatalog): Promise<number> {
  const { table, key } = SEARCH_TEXT_TARGETS[catalog];
  return db.transaction(async (tx) => {
    const rows = await tx.all(`SELECT * FROM ${table} WHERE search_text IS NULL ORDER BY ${key} LIMIT ? FOR UPDATE`, [
      SEARCH_TEXT_BATCH_SIZE,
    ]);
    let filled = 0;
    for (const row of rows) {
      const result = await tx.run(`UPDATE ${table} SET search_text=? WHERE ${key}=? AND search_text IS NULL`, [
        buildMasterSearchText(catalog, row),
        String(row[key]),
      ]);
      filled += result.changes;
    }
    return filled;
  });
}

export async function backfillSearchText(db: Database): Promise<Record<SearchTextCatalog, number>> {
  const counts = { products: 0, customers: 0, suppliers: 0, vehicles: 0 };
  for (const catalog of Object.keys(counts) as SearchTextCatalog[]) {
    let filled: number;
    do {
      filled = await fillBatch(db, catalog);
      counts[catalog] += filled;
    } while (filled > 0);
  }
  return counts;
}

// Seed paths also support test databases created before migration 022.
export async function backfillSeedSearchText(db: Database): Promise<void> {
  if (await db.get("SHOW COLUMNS FROM master_products LIKE 'search_text'")) await backfillSearchText(db);
}
