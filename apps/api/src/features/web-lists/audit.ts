import { webAuditListSchema, webAuditDetailSchema, type WebAuditQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { AppError } from '../../shared/errors.ts';
import { dateFilter, pageResult, readPage, textFilter } from './query.ts';

const fields = 'id,action,target_id AS targetId,actor,trace_id AS traceId,created_at AS createdAt';
const sortColumns = { createdAt: 'created_at', id: 'id', action: 'action', targetId: 'target_id', actor: 'actor' };
export function auditPredicate(query: WebAuditQuery) {
  const parts = { sql: 'FROM operation_log WHERE 1=1', values: [] as string[] };
  textFilter(parts, ['action'], query.action);
  textFilter(parts, ['target_id'], query.target);
  textFilter(parts, ['trace_id'], query.traceId);
  dateFilter(parts, 'created_at', query);
  return parts;
}
export async function listWebAudit(db: Database, query: WebAuditQuery) {
  return db.transaction(async (tx) => {
    const page = await readPage(
      tx,
      {
        fields,
        predicate: auditPredicate(query),
        order: `${sortColumns[query.sortBy]} ${query.direction},id ${query.direction}`,
      },
      query,
    );
    const items = page.rows.map((row) => ({ ...row, id: Number(row.id), createdAt: isoDate(row.createdAt) }));
    return webAuditListSchema.parse(pageResult(items, page.total, query));
  });
}
export async function readWebAudit(db: Database, id: number) {
  const row = await db.get(
    `SELECT ${fields},before_json AS beforeJson,after_json AS afterJson FROM operation_log WHERE id=?`,
    [id],
  );
  if (!row) throw new AppError('NOT_FOUND', '操作日志不存在', 404);
  return webAuditDetailSchema.parse({ ...row, id: Number(row.id), createdAt: isoDate(row.createdAt) });
}
