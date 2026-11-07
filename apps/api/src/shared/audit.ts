import type { Database } from '../db/mysql.ts';
import { sqlDate } from '../db/dates.ts';

export interface Actor { username: string; traceId: string }
interface AuditEntry { action: string; targetId: string; before: unknown; after: unknown }
export async function audit(db: Database, actor: Actor, entry: AuditEntry): Promise<void> {
  await db.run(`INSERT INTO operation_log(action,target_id,actor,trace_id,before_json,after_json,created_at)
    VALUES(?,?,?,?,?,?,?)`, [entry.action,entry.targetId,actor.username,actor.traceId,
    JSON.stringify(entry.before),JSON.stringify(entry.after),sqlDate(new Date().toISOString())]);
}
