import { auditDetailSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { auditRecord, recordTrace, eventPage, tracePredicate } from './records.ts';
import { projectAuditRows } from './projection.ts';
import { auditChanges } from './changes.ts';
export async function readWebAudit(db: Database, id: string) {
  return db.readSnapshot(async (tx) => {
    const row = await auditRecord(tx, id),
      trace = await recordTrace(tx, row);
    const related = await eventPage(tx, tracePredicate(trace));
    const raw =
      row.source === 'business_event'
        ? await tx.get('SELECT before_json,after_json FROM operation_log WHERE id=?', [String(row.source_id)])
        : undefined;
    return auditDetailSchema.parse({
      ...(await projectAuditRows(tx, [row]))[0],
      changes: raw ? auditChanges(String(row.action), raw.before_json, raw.after_json) : [],
      related: {
        items: await projectAuditRows(tx, related.rows),
        total: related.total,
        nextCursor: related.nextCursor,
      },
    });
  });
}
export async function relatedEvents(db: Database, id: string, cursor?: string) {
  return db.readSnapshot(async (tx) => {
    const row = await auditRecord(tx, id);
    const result = await eventPage(tx, tracePredicate(await recordTrace(tx, row)), cursor);
    return { items: await projectAuditRows(tx, result.rows), total: result.total, nextCursor: result.nextCursor };
  });
}
