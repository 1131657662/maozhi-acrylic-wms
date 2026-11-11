import type { Database } from '../db/mysql.ts';
import { sqlDate } from '../db/dates.ts';
import { randomUUID } from 'node:crypto';
import { auditContext, type AuditIdentity } from '../features/audit/context.ts';
import { redactAuditValue } from '../features/audit/sanitize.ts';
import { eventMetadata, type AuditEntry } from '../features/audit/event-metadata.ts';
import { auditChanges, auditSummary } from '../features/audit/changes.ts';
import { auditObject } from '../features/audit/input-summary.ts';
import { businessText } from '../features/audit/projection.ts';

export type Actor = AuditIdentity;
export async function audit(db: Database, actor: Actor, entry: AuditEntry): Promise<void> {
  const context = auditContext.getStore();
  const metadata = eventMetadata(entry);
  const changes = auditChanges(entry.action, entry.before, entry.after);
  const value = { ...auditObject(entry.before), ...auditObject(entry.after) };
  await db.run(
    `INSERT INTO operation_log(action,target_id,actor,trace_id,before_json,after_json,created_at,
    attempt_id,channel,result,effect_state,target_kind,target_no,target_label,summary,projection_json,projection_version)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      entry.action,
      entry.targetId,
      actor.username,
      context?.traceId ?? actor.traceId,
      JSON.stringify(redactAuditValue(entry.before)),
      JSON.stringify(redactAuditValue(entry.after)),
      sqlDate(new Date().toISOString()),
      context?.attemptId ?? randomUUID(),
      context?.channel ?? actor.channel ?? null,
      metadata.result,
      metadata.effect,
      metadata.kind,
      metadata.number,
      businessText(value.name, '') || null,
      auditSummary(changes),
      JSON.stringify(changes),
      1,
    ],
  );
}
