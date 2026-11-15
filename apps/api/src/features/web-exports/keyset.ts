import type { Database, Row } from '../../db/mysql.ts';
import type { Predicate } from '../web-lists/query.ts';
import { keysetSql, type KeysetOptions } from './keyset-sql.ts';

export const EXPORT_BATCH_SIZE = 1000;
export const AUDIT_EXPORT_BATCH_SIZE = 2000;
export type CursorValue = string | number | null;
export interface ExportCursor {
  keys: CursorValue[];
  position: number;
}
export interface KeysetRead {
  after?: ExportCursor;
  accept: (cursor: ExportCursor | undefined) => void;
}
export interface KeysetSource {
  fields: string;
  predicate: Predicate;
  order: string;
  keys?: string[];
  hint?: string;
  branches?: (Predicate & { load?: (selection: string) => string })[];
}

async function readRows(db: Database, source: KeysetSource, options: KeysetOptions) {
  const keys = [...new Set(source.keys)];
  if (!keys.length) throw new Error('Missing export ordering keys');
  const { sql, values } = keysetSql(source, keys, options);
  const rows = await db.all(sql, values);
  const last = rows.at(-1);
  const cursor = last
    ? {
        keys: keys.map((_, i) => cursorValue(last[`__export_key_${i}`])),
        position: (options.after?.position ?? 0) + rows.length,
      }
    : undefined;
  for (const row of rows)
    keys.forEach((_, i) => {
      delete row[`__export_key_${i}`];
    });
  return { rows, cursor };
}
function cursorValue(value: unknown): CursorValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  throw new Error('Unsupported export cursor value');
}

export async function readKeysetPage(
  db: Database,
  source: KeysetSource,
  query: {
    page: number;
    pageSize: number;
    direction: 'asc' | 'desc';
    exportKeyset: KeysetRead;
  },
): Promise<Row[]> {
  let after = query.exportKeyset.after;
  let remaining = after ? 0 : (query.page - 1) * query.pageSize;
  while (remaining > 0) {
    const size = Math.min(remaining, EXPORT_BATCH_SIZE);
    const skipped = await readRows(db, source, { after, size, direction: query.direction, keysOnly: true });
    if (skipped.rows.length < size) {
      query.exportKeyset.accept(undefined);
      return [];
    }
    remaining -= skipped.rows.length;
    after = skipped.cursor;
  }
  const page = await readRows(db, source, { after, size: query.pageSize, direction: query.direction });
  query.exportKeyset.accept(page.cursor);
  return page.rows;
}
