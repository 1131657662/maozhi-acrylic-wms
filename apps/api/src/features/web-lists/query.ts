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
}
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
  const count = await db.get(`SELECT COUNT(*) AS total ${predicate.sql}`, predicate.values);
  const rows = await db.all(`SELECT ${input.fields} ${predicate.sql} ORDER BY ${input.order} LIMIT ? OFFSET ?`, [
    ...predicate.values,
    query.pageSize,
    (query.page - 1) * query.pageSize,
  ]);
  return { rows, total: Number(count?.total ?? 0) };
}
export function pageResult<T>(items: T[], total: number, query: PageQuery) {
  const result = { items, total, page: query.page, pageSize: query.pageSize };
  return { ...result, viewToken: hash(JSON.stringify(result)) };
}
export function aggregateGrams(value: unknown): number {
  const decimal = String(value);
  if (!/^-?\d+\.\d{4}$/.test(decimal)) throw new Error('汇总重量格式不正确');
  const result = Number(BigInt(decimal.replace('.', '')) * 100n);
  if (!Number.isSafeInteger(result)) throw new Error('汇总重量超出安全整数范围');
  return result;
}
