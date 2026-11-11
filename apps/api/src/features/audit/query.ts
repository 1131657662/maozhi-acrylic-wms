import { auditActions, AUDIT_DEFAULT_DAYS, shanghaiToday, type WebAuditQuery } from '@wms/contracts';
import { dateFilter, textFilter, type Predicate, type ListReadQuery } from '../web-lists/query.ts';
import { auditKeyword } from './keyword.ts';
const kinds = Object.entries(auditActions)
  .map(
    ([action, value]) =>
      `WHEN '${action}' THEN ${value.kind === 'master' ? "CONCAT('master.',SUBSTRING_INDEX(target_id,':',1))" : `'${value.kind}'`}`,
  )
  .join(' ');
export const eventProjection = `SELECT CONCAT('event:',id) AS record_id,'business_event' AS source,CAST(id AS CHAR) AS source_id,
 actor,channel,action,COALESCE(target_kind,CASE action ${kinds} END) AS target_kind,target_id,target_no,target_label,
 result,effect_state,created_at,summary FROM operation_log`;
export const attemptProjection = `SELECT CONCAT('attempt:',attempt_id) AS record_id,'attempt' AS source,attempt_id AS source_id,
 actor,channel,action,target_kind,target_id,target_no,target_label,result,effect_state,occurred_at AS created_at,
 failure_reason AS summary FROM operation_attempts`;
export const auditUnion = `(${eventProjection} UNION ALL ${attemptProjection}) audit_records`;
export const auditSafeFields =
  'record_id,source,source_id,actor,channel,action,target_kind,target_id,target_no,target_label,result,effect_state,created_at,summary';
export type AuditQuery = ListReadQuery<WebAuditQuery>;
export function auditPredicate(query: AuditQuery): Predicate {
  const parts: Predicate = { sql: `FROM ${auditUnion} WHERE 1=1`, values: [] };
  if (query.action) {
    const names = Object.entries(auditActions)
      .filter(([, item]) => item.label.includes(query.action))
      .map(([key]) => key);
    if (names.length) {
      parts.sql += ` AND action IN (${names.map(() => '?').join(',')})`;
      parts.values.push(...names);
    } else textFilter(parts, ['action'], query.action);
  }
  textFilter(parts, ['target_no', 'target_label'], query.target);
  auditKeyword(parts, query.keyword);
  dateFilter(parts, 'created_at', auditDates(query));
  for (const key of ['channel', 'result'] as const) {
    if (query[key] === 'missing') parts.sql += ` AND ${key} IS NULL`;
    else if (query[key]) {
      parts.sql += ` AND ${key}=?`;
      parts.values.push(query[key]);
    }
  }
  if (query.dangerous) {
    const actions = Object.entries(auditActions)
      .filter(([, value]) => value.dangerous)
      .map(([key]) => key);
    parts.sql += ` AND action ${query.dangerous === 'true' ? 'IN' : 'NOT IN'} (${actions.map(() => '?').join(',')})`;
    parts.values.push(...actions);
  }
  return parts;
}
function auditDates(query: { from?: string; to?: string }) {
  if (query.from || query.to) return query;
  const start = new Date(`${shanghaiToday()}T00:00:00+08:00`);
  start.setUTCDate(start.getUTCDate() - AUDIT_DEFAULT_DAYS + 1);
  return { from: start.toISOString() };
}
export const auditSort: Record<WebAuditQuery['sortBy'], string> = {
  createdAt: 'created_at',
  id: 'record_id',
  action: 'action',
  targetId: 'target_no',
  objectLabel: 'target_no',
  actor: 'actor',
};
