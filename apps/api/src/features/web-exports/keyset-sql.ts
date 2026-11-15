import type { CursorValue, ExportCursor, KeysetSource } from './keyset.ts';

export interface KeysetOptions {
  after?: ExportCursor;
  size: number;
  direction: 'asc' | 'desc';
  keysOnly?: boolean;
}

// NULL sorts before non-NULL in MySQL ASC. <=> retains equal NULL prefixes.
export function seekPredicate(keys: string[], cursor: CursorValue[], direction: 'asc' | 'desc') {
  if (keys.length !== cursor.length) throw new Error('Invalid internal export cursor');
  const values: CursorValue[] = [];
  const terms = keys.map((key, i) => {
    const prefix = keys.slice(0, i).map((column, j) => {
      values.push(cursor[j]!);
      return `${column}<=>?`;
    });
    const value = cursor[i]!;
    if (value === null) return [...prefix, direction === 'asc' ? `${key} IS NOT NULL` : 'FALSE'].join(' AND ');
    values.push(value);
    const compare = `${key}${direction === 'asc' ? '>' : '<'}?`;
    return [...prefix, direction === 'desc' ? `(${compare} OR ${key} IS NULL)` : compare].join(' AND ');
  });
  // Expanded lexicographic ranges let MySQL use all index key parts (tuple-only
  // inequalities can scan the entire prefix). The tuple also documents the cursor contract.
  const range = `(${terms.map((term) => `(${term})`).join(' OR ')})`;
  if (cursor.includes(null)) return { sql: range, values };
  const tuple = `(${keys.join(',')})${direction === 'asc' ? '>' : '<'}(${keys.map(() => '?').join(',')})`;
  const nulls = direction === 'desc' ? ` OR ${keys.map((key) => `${key} IS NULL`).join(' OR ')}` : '';
  return { sql: `${range} AND (${tuple}${nulls})`, values: [...values, ...cursor] };
}

export function keysetSql(source: KeysetSource, keys: string[], options: KeysetOptions) {
  const seek = options.after ? seekPredicate(keys, options.after.keys, options.direction) : { sql: 'TRUE', values: [] };
  const fields = keys.map((key, i) => `${key} AS __export_key_${i}`).join(',');
  const select = `SELECT ${source.hint ?? ''} ${options.keysOnly ? '' : source.fields + ','}${fields}`;
  const branches: NonNullable<KeysetSource['branches']> = source.branches ?? [source.predicate];
  const order = keys.map((key) => `${key} ${options.direction}`).join(',');
  const statements = branches.map((branch) => {
    const selection = `${branch.load ? 'SELECT source_id,' + fields : select} ${branch.sql} AND (${seek.sql}) ORDER BY ${order} LIMIT ?`;
    return branch.load && !options.keysOnly ? `${select} FROM (${branch.load(selection)}) audit_records` : selection;
  });
  const values = branches.flatMap((branch) => [...branch.values, ...seek.values, options.size]);
  const sql =
    statements.length === 1
      ? statements[0]!
      : `${statements.map((s) => `(${s})`).join(' UNION ALL ')}
    ORDER BY ${keys.map((_, i) => `__export_key_${i} ${options.direction}`).join(',')} LIMIT ?`;
  if (statements.length > 1) values.push(options.size);
  return { sql, values };
}
