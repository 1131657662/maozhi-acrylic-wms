import { randomUUID } from 'node:crypto';
import { maintenanceHttpFixture, maintenanceActor } from './maintenance-fixture.ts';
import { captureBaseline } from '../src/features/maintenance/baseline.ts';

export async function restoreFixture() {
  const c = await maintenanceHttpFixture();
  return { ...c, actor: maintenanceActor };
}
export async function backupForRestore(c: Awaited<ReturnType<typeof restoreFixture>>): Promise<string> {
  const { jobId } = await c.service.create(c.actor, randomUUID());
  await c.service.settled();
  const row = await c.db.get('SELECT status,error FROM maintenance_jobs WHERE id=?', [jobId]);
  if (row?.status !== 'succeeded') throw new Error(String(row?.error));
  return jobId;
}
export async function originalBusinessFingerprint(c: Awaited<ReturnType<typeof restoreFixture>>) {
  const baseline = await captureBaseline(c.db);
  return baseline.tables.filter(
    (table) =>
      ![
        'maintenance_jobs',
        'backup_artifacts',
        'scheduler_runs',
        'restore_verifications',
        'operation_log',
        'operation_attempts',
        'sessions',
      ].includes(table.name),
  );
}
