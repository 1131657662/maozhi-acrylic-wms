import { createHash } from 'node:crypto';
import type { Database } from '../apps/api/src/db/mysql.ts';

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const identifier = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unexpected database identifier');
  return '`' + name + '`';
};
export interface TableFingerprint {
  columns: string[];
  rows: number;
  sha256: string;
}
export async function tableFingerprints(db: Database, projection?: Record<string, TableFingerprint>) {
  const tables = projection
    ? Object.keys(projection)
    : (await db.all('SHOW FULL TABLES WHERE Table_type="BASE TABLE"'))
        .map((row) => String(Object.values(row)[0]))
        .sort();
  const result: Record<string, TableFingerprint> = {};
  for (const table of tables) {
    const columns =
      projection?.[table]?.columns ??
      (await db.all(`SHOW COLUMNS FROM ${identifier(table)}`)).map((row) => String(row.Field));
    const rows = await db.all(`SELECT ${columns.map(identifier).join(',')} FROM ${identifier(table)}`);
    result[table] = {
      columns,
      rows: rows.length,
      sha256: sha256(JSON.stringify(rows.map((row) => JSON.stringify(row)).sort())),
    };
  }
  return result;
}
