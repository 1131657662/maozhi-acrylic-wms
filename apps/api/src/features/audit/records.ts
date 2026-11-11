import { auditIdSchema, AUDIT_EVENT_PAGE_SIZE, AUDIT_MAX_RECORDS } from '@wms/contracts';
import { z } from 'zod';
import type { Database, Row } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { eventProjection, attemptProjection, auditSafeFields } from './query.ts';
import type { Predicate } from '../web-lists/query.ts';
export function auditId(value: unknown): string {
  return auditIdSchema.parse(typeof value === 'string' && /^[1-9]\d*$/.test(value) ? `event:${value}` : value);
}
export async function auditRecord(db: Database, id: string): Promise<Row> {
  const key = auditId(id),
    event = key.startsWith('event:');
  const row = await db.get(`${event ? eventProjection : attemptProjection} WHERE ${event ? 'id' : 'attempt_id'}=?`, [
    key.slice(key.indexOf(':') + 1),
  ]);
  if (!row) throw new AppError('NOT_FOUND', '操作记录不存在', 404);
  return row;
}
export async function recordTrace(db: Database, row: Row): Promise<string> {
  const source =
    row.source === 'business_event'
      ? { table: 'operation_log', id: 'id' }
      : { table: 'operation_attempts', id: 'attempt_id' };
  const value = await db.get(`SELECT trace_id FROM ${source.table} WHERE ${source.id}=?`, [String(row.source_id)]);
  return String(value!.trace_id);
}
export function tracePredicate(trace: string): Predicate {
  return {
    sql: `FROM (${eventProjection} WHERE trace_id=? UNION ALL ${attemptProjection} WHERE trace_id=?) trace_records WHERE 1=1`,
    values: [trace, trace],
  };
}
const cursorSchema = z.object({ time: z.string().regex(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/), id: auditIdSchema });
export function afterCursor(cursor?: string): Predicate {
  if (!cursor) return { sql: '', values: [] };
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new AppError('INVALID_CURSOR', '加载位置已失效，请重新查询', 422);
  }
  const value = cursorSchema.parse(data);
  return { sql: ' AND (created_at<? OR (created_at=? AND record_id<?))', values: [value.time, value.time, value.id] };
}
export function nextCursor(rows: Row[], size: number): string | null {
  const row = rows[size - 1];
  return rows.length > size && row
    ? Buffer.from(JSON.stringify({ time: row.created_at, id: row.record_id })).toString('base64url')
    : null;
}
export async function eventPage(db: Database, predicate: Predicate, cursor?: string, size = AUDIT_EVENT_PAGE_SIZE) {
  const total = Number((await db.get(`SELECT COUNT(*) AS n ${predicate.sql}`, predicate.values))?.n);
  const after = afterCursor(cursor);
  const rows = await db.all(
    `SELECT ${auditSafeFields} ${predicate.sql}${after.sql} ORDER BY created_at DESC,record_id DESC LIMIT ?`,
    [...predicate.values, ...after.values, size + 1],
  );
  return { rows: rows.slice(0, size), total, nextCursor: nextCursor(rows, size) };
}
export function assertRecordLimit(total: number): void {
  if (total > AUDIT_MAX_RECORDS) throw new AppError('AUDIT_LIMIT', `共有 ${total} 条记录，超过 10 万条上限`, 422);
}
