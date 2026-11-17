import { createHash } from 'node:crypto';
import { RESTORE, type BackupBaseline } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { normalizeSqlStructure } from './sql-structure.ts';

export function sqlIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('数据表名称不符合本项目规范');
  return `\`${value}\``;
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export async function databaseTables(db: Database): Promise<string[]> {
  const rows = await db.all(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME',
  );
  return rows.map((row) => String(row.name));
}
export async function tableFingerprint(db: Database, name: string): Promise<BackupBaseline['tables'][number]> {
  const columns = await db.all(
    `SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLLATION_NAME
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
    [name],
  );
  const indexes = await db.all(
    `SELECT INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY INDEX_NAME,SEQ_IN_INDEX`,
    [name],
  );
  const primary = indexes
    .filter((row) => row.INDEX_NAME === 'PRIMARY')
    .map((row) => sqlIdentifier(String(row.COLUMN_NAME)));
  const definition = await db.get(`SHOW CREATE TABLE ${sqlIdentifier(name)}`);
  const view = definition?.['Create View'];
  if (!primary.length && !view) throw new Error('核验表缺少稳定主键');
  if (view) primary.push(...columns.map((row) => sqlIdentifier(String(row.COLUMN_NAME))));
  const triggers = await db.all(
    `SELECT TRIGGER_NAME,EVENT_MANIPULATION,ACTION_TIMING,ACTION_ORDER,SQL_MODE,ACTION_STATEMENT
    FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=? ORDER BY TRIGGER_NAME`,
    [name],
  );
  for (const trigger of triggers) trigger.ACTION_STATEMENT = normalizeSqlStructure(String(trigger.ACTION_STATEMENT));
  const { rows, content } = await tableContent(db, name, primary);
  const ddl = String(view ?? definition?.['Create Table'])
    .replace(/^(CREATE ALGORITHM=\w+ )DEFINER=`[^`]+`@`[^`]+` /, '$1')
    .replace(/^(\) ENGINE=\w+) AUTO_INCREMENT=\d+/m, '$1')
    .replace(/^(\s+`[^`]+` [^\n]*?) CHARACTER SET [a-z0-9_]+(?= COLLATE [a-z0-9_]+)/gm, '$1')
    .replaceAll('\r\n', '\n');
  return { name, rows, structure: fingerprint({ columns, indexes, ddl, triggers }), content };
}

async function tableContent(db: Database, name: string, primary: string[]): Promise<{ rows: number; content: string }> {
  const hash = createHash('sha256');
  let rows = 0;
  while (true) {
    const page = await db.all(`SELECT * FROM ${sqlIdentifier(name)} ORDER BY ${primary.join(',')} LIMIT ? OFFSET ?`, [
      RESTORE.fingerprintPage,
      rows,
    ]);
    for (const row of page) hash.update(JSON.stringify(row) + '\n');
    rows += page.length;
    if (page.length < RESTORE.fingerprintPage) break;
  }
  return { rows, content: hash.digest('hex') };
}
