import { randomUUID } from 'node:crypto';
import { maintenanceJobSchema, type MaintenanceJob, type MaintenanceJobsQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { maintenanceErrors as copy } from './copy.ts';

export async function existingBackup(db: Database, actor: Actor, key: string): Promise<string | null> {
  const row = await db.get('SELECT id FROM maintenance_jobs WHERE operator=? AND operation_id=? AND kind=?', [
    actor.username,
    key,
    'backup',
  ]);
  return row ? String(row.id) : null;
}
export async function insertBackup(db: Database, actor: Actor, key: string): Promise<string> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO maintenance_jobs(id,kind,status,started_at,operator,params,operation_id)
      VALUES(?,'backup','queued',UTC_TIMESTAMP(3),?,'{}',?)`,
      [id, actor.username, key],
    );
    await audit(tx, actor, {
      action: 'maintenance.backup',
      targetId: id,
      before: null,
      after: { name: '数据库备份任务' },
    });
  });
  return id;
}
export async function interruptBackups(db: Database): Promise<void> {
  await db.run(
    `UPDATE maintenance_jobs SET status='interrupted',finished_at=UTC_TIMESTAMP(3),error=?
    WHERE status IN ('queued','running')`,
    [copy.interrupted],
  );
}
export async function listMaintenanceJobs(db: Database, query: MaintenanceJobsQuery): Promise<MaintenanceJob[]> {
  const rows = await db.all(
    `SELECT id,kind,status,started_at,finished_at,operator,error FROM maintenance_jobs
    ${query.kind ? 'WHERE kind=?' : ''} ORDER BY started_at DESC,id DESC LIMIT ?`,
    query.kind ? [query.kind, query.limit] : [query.limit],
  );
  return rows.map(projectJob);
}
export function projectJob(row: Row): MaintenanceJob {
  const startedAt = isoDate(row.started_at);
  const finishedAt = row.finished_at ? isoDate(row.finished_at) : null;
  return maintenanceJobSchema.parse({
    id: row.id,
    kind: row.kind,
    status: row.status,
    startedAt,
    finishedAt,
    operator: row.operator,
    error: row.error,
    elapsedMs: Math.max(0, (finishedAt ? Date.parse(finishedAt) : Date.now()) - Date.parse(startedAt)),
  });
}
