import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './mysql/test-database.ts';
import { auditPredicate, auditSafeFields } from '../apps/api/src/features/audit/query.ts';
import { tracePredicate } from '../apps/api/src/features/audit/records.ts';
import { auditTimeline } from '../apps/api/src/features/audit/timeline.ts';
import { webAuditQuerySchema } from '@wms/contracts';

const c = await createTestDatabase();
try {
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const rows = Array.from({ length: 1000 }, (_, index) => {
      const n = offset + index;
      return ['inbound.confirm', `object-${n % 10_000}`, `trace-${n % 30_000}`, `RK-${n % 10_000}`];
    });
    await c.db.run(
      `INSERT INTO operation_log(action,target_id,trace_id,target_no,actor,target_kind,result,channel,created_at,before_json,after_json)
      VALUES ${rows.map(() => "(?,?,?,?,'owner','inbound','success','web',UTC_TIMESTAMP(3),'null','{}')").join(',')}`,
      rows.flat(),
    );
  }
  for (let offset = 0; offset < 1000; offset++)
    await c.db.run(
      `INSERT INTO operation_attempts
    (attempt_id,actor,channel,action,target_kind,target_id,target_no,result,effect_state,trace_id,occurred_at,input_summary,error_code,failure_reason)
    VALUES(?,'owner','web','inbound.confirm','inbound',?,?,'failed','not_applied',?,UTC_TIMESTAMP(3),'{}','CONFLICT','单据状态已变化')`,
      [randomUUID(), `object-${offset}`, `RK-${offset}`, `trace-${offset}`],
    );
  await c.db.run('ANALYZE TABLE operation_log,operation_attempts');
  const query = webAuditQuerySchema.parse({}),
    predicate = auditPredicate(query);
  const sql: { name: string; query: string; values: (string | number)[] }[] = [
    {
      name: 'list',
      query: `SELECT ${auditSafeFields} ${predicate.sql} ORDER BY created_at DESC,record_id DESC LIMIT 50`,
      values: predicate.values,
    },
    {
      name: 'keyword',
      query: `SELECT ${auditSafeFields} ${auditPredicate(webAuditQuerySchema.parse({ keyword: 'RK-333' })).sql} ORDER BY created_at DESC,record_id DESC LIMIT 50`,
      values: auditPredicate(webAuditQuerySchema.parse({ keyword: 'RK-333' })).values,
    },
    {
      name: 'trace',
      query: `SELECT ${auditSafeFields} ${tracePredicate('trace-333').sql} ORDER BY created_at DESC,record_id DESC LIMIT 50`,
      values: ['trace-333', 'trace-333'],
    },
  ];
  const connection = c.db.withConnection.bind(c.db);
  c.db.withConnection = (work) =>
    connection(async (tx) => {
      const all = tx.all.bind(tx);
      tx.all = (query, values = []) => {
        if (query.startsWith('SELECT') && (query.includes(' AS latest') || query.includes('ranked WHERE')))
          sql.push({
            name: query.includes('ranked WHERE') ? 'object-events' : 'object-page',
            query,
            values: values.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number'),
          });
        return all(query, values);
      };
      return work(tx);
    });
  await auditTimeline(c.db, query);
  for (const item of sql) {
    const plan = await c.db.all('EXPLAIN ' + item.query, item.values);
    const analysis = await c.db.all('EXPLAIN ANALYZE ' + item.query, item.values);
    console.log(JSON.stringify({ name: item.name, events: 100_000, attempts: 1000, plan, analysis }));
  }
} finally {
  await c.dispose();
}
