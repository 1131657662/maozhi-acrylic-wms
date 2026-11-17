import { randomUUID } from 'node:crypto';
import {
  restoreDetailSchema,
  restoreReportSchema,
  restoreEvidenceSchema,
  type RestoreDetail,
  type RestoreReport,
  type RestoreStage,
} from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { projectJob } from './jobs.ts';
import { restoreText as t } from './restore-copy.ts';

export function jsonValue(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
export async function restoreReplay(
  db: Database,
  input: { actor: Actor; key: string; artifactId: string },
): Promise<string | null> {
  const row = await db.get('SELECT id,kind,params FROM maintenance_jobs WHERE operator=? AND operation_id=?', [
    input.actor.username,
    input.key,
  ]);
  if (!row) return null;
  const params = jsonValue(row.params);
  if (
    row.kind !== 'restore' ||
    !params ||
    typeof params !== 'object' ||
    !('artifactId' in params) ||
    params.artifactId !== input.artifactId
  )
    throw new AppError('MAINTENANCE_KEY_CONFLICT', t.conflict, 409);
  return String(row.id);
}
export async function insertRestore(
  db: Database,
  input: { actor: Actor; key: string; artifactId: string },
): Promise<string> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO maintenance_jobs(id,kind,status,started_at,operator,params,operation_id)
      VALUES(?,'restore','queued',UTC_TIMESTAMP(3),?,?,?)`,
      [id, input.actor.username, JSON.stringify({ artifactId: input.artifactId }), input.key],
    );
    await tx.run("INSERT INTO restore_verifications(job_id,artifact_id,stage,evidence) VALUES(?,?,'backup','[]')", [
      id,
      input.artifactId,
    ]);
    await restoreAudit(tx, input.actor, { id, action: 'maintenance.restore', message: t.name });
  });
  return id;
}
export async function restoreAudit(
  db: Database,
  actor: Actor,
  input: { id: string; action: string; message: string },
): Promise<void> {
  await audit(db, actor, {
    action: input.action,
    targetId: input.id,
    before: null,
    after: { name: t.name, reason: input.message },
  });
}
export async function restoreEvidence(
  db: Database,
  id: string,
  input: { stage: RestoreStage; message: string },
): Promise<void> {
  const entry = { ...input, at: new Date().toISOString() };
  await db.run(
    "UPDATE restore_verifications SET stage=?,evidence=JSON_ARRAY_APPEND(evidence,'$',CAST(? AS JSON)) WHERE job_id=?",
    [input.stage, JSON.stringify(entry), id],
  );
}
export async function restoreRow(db: Database, id: string): Promise<Row> {
  const row = await db.get('SELECT * FROM restore_verifications WHERE job_id=?', [id]);
  if (!row) throw new AppError('RESTORE_NOT_FOUND', t.missing, 404);
  return row;
}
export async function saveRestoreReport(db: Database, id: string, report: RestoreReport): Promise<void> {
  await db.run('UPDATE restore_verifications SET report=? WHERE job_id=?', [
    JSON.stringify(restoreReportSchema.parse(report)),
    id,
  ]);
}
export async function restoreDetail(db: Database, id: string): Promise<RestoreDetail> {
  const row = await restoreRow(db, id),
    job = await db.get('SELECT * FROM maintenance_jobs WHERE id=?', [id]);
  if (!job) throw new AppError('RESTORE_NOT_FOUND', t.missing, 404);
  return restoreDetailSchema.parse({
    job: projectJob(job),
    stage: row.stage,
    report: jsonValue(row.report),
    evidence: restoreEvidenceSchema.parse(jsonValue(row.evidence)),
    databaseRetained: Boolean(row.database_created),
    accountLocked: Boolean(row.account_locked),
  });
}
