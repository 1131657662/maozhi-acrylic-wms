import { backupArtifactSchema, type BackupArtifact, type MaintenancePageQuery, MAINTENANCE } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

const active =
  "FROM backup_artifacts a JOIN maintenance_jobs j ON j.id=a.job_id WHERE JSON_EXTRACT(j.result,'$.deletedAt') IS NULL";
const fields = 'a.id,a.job_id,a.path,a.bytes,a.sha256,a.created_at,a.retention_class,a.baseline,j.result';
export async function listArtifacts(
  db: Database,
  query: MaintenancePageQuery,
): Promise<{ items: BackupArtifact[]; total: number }> {
  const count = await db.get(`SELECT COUNT(*) AS total ${active}`);
  const rows = await db.all(`SELECT ${fields} ${active} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`, [
    query.limit,
    (query.page - 1) * query.limit,
  ]);
  return { items: rows.map(projectArtifact), total: Number(count?.total) };
}
export async function activeArtifacts(db: Database): Promise<Row[]> {
  const rows = await db.all(`SELECT ${fields} ${active} ORDER BY a.created_at DESC,a.id DESC LIMIT ?`, [
    MAINTENANCE.maxRetentionItems + 1,
  ]);
  if (rows.length > MAINTENANCE.maxRetentionItems) throw new AppError('RETENTION_LIMIT', copy.tooMany, 409);
  return rows;
}
export async function readArtifact(db: Database, id: string): Promise<Row> {
  const row = await db.get(`SELECT ${fields} ${active} AND a.id=?`, [id]);
  if (!row) throw new AppError('BACKUP_NOT_FOUND', copy.file, 404);
  return row;
}
export function projectArtifact(row: Row): BackupArtifact {
  return backupArtifactSchema.parse({
    id: row.id,
    bytes: Number(row.bytes),
    sha256: row.sha256,
    createdAt: isoDate(row.created_at),
    retentionClass: row.retention_class,
    hasBaseline: row.baseline !== null && row.baseline !== undefined,
  });
}
