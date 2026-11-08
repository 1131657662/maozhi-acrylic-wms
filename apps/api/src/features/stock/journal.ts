import { journalSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { journalFields, journalItem, journalOperationJoin } from './journal-row.ts';

export async function journalRows(db: Database, limit: number) {
  const rows = await db.all(
    `SELECT ${journalFields} FROM stock_journal j ${journalOperationJoin}
    WHERE j.source_del_flag=0 ORDER BY j.id DESC LIMIT ?`,
    [limit],
  );
  return journalSchema.parse(rows.map(journalItem));
}
