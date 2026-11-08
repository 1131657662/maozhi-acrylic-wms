import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { hash } from '../../shared/hash.ts';

export interface Predicate {
  sql: string;
  values: (string | number)[];
}
export interface PageQuery {
  page: number;
  pageSize: number;
  direction: 'asc' | 'desc';
  exportSnapshot?: ExportSnapshot;
}
export interface ExportSnapshot {
  total: number;
  subtotal?: { packages: number; weightGrams: number };
}
export type ListReadQuery<Q> = Omit<Q, 'pageSize'> & { pageSize: number; exportSnapshot?: ExportSnapshot };
export function contains(value: string): string {
  return `%${value.replace(/[!%_]/g, '!$&')}%`;
}
export function textFilter(parts: Predicate, columns: string[], value: string): void {
  if (!value) return;
  parts.sql += ` AND (${columns.map((column) => `${column} LIKE ? ESCAPE '!'`).join(' OR ')})`;
  parts.values.push(...columns.map(() => contains(value)));
}
export function dateFilter(parts: Predicate, column: string, query: { from?: string; to?: string }): void {
  if (query.from) {
    parts.sql += ` AND ${column}>=?`;
    parts.values.push(sqlDate(new Date(query.from).toISOString()));
  }
  if (query.to) {
    parts.sql += ` AND ${column}<=?`;
    parts.values.push(sqlDate(new Date(query.to).toISOString()));
  }
}
export function statusFilter(
  parts: Predicate,
  column: string,
  query: { status?: string; statusMissing?: string },
): void {
  if (query.status !== undefined) {
    parts.sql += ` AND ${column}=?`;
    parts.values.push(query.status);
  }
  if (query.statusMissing) parts.sql += ` AND ${column} IS NULL`;
}
export async function readPage(
  db: Database,
  input: { fields: string; predicate: Predicate; order: string },
  query: PageQuery,
) {
  const { predicate } = input;
  const total =
    query.exportSnapshot?.total ??
    Number((await db.get(`SELECT COUNT(*) AS total ${predicate.sql}`, predicate.values))?.total ?? 0);
  const rows = await db.all(`SELECT ${input.fields} ${predicate.sql} ORDER BY ${input.order} LIMIT ? OFFSET ?`, [
    ...predicate.values,
    query.pageSize,
    (query.page - 1) * query.pageSize,
  ]);
  return { rows, total };
}
export function rowToken(row: Record<string, unknown>): string {
  return hash(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );
}
export function pageResult<T extends Record<string, unknown>>(items: T[], total: number, query: PageQuery) {
  const result = { items, total, page: query.page, pageSize: query.pageSize };
  const rowTokens = Object.fromEntries(items.map((row) => [String(row.id), rowToken(row)]));
  return { ...result, rowTokens, viewToken: hash(JSON.stringify(result)) };
}
export function aggregateGrams(value: unknown): number {
  const decimal = String(value);
  if (!/^-?\d+\.\d{4}$/.test(decimal)) throw new Error('汇总重量格式不正确');
  const result = Number(BigInt(decimal.replace('.', '')) * 100n);
  if (!Number.isSafeInteger(result)) throw new Error('汇总重量超出安全整数范围');
  return result;
}
