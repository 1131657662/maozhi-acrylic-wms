import { createHash, randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { adminConfig } from '../../../scripts/mysql/local-config.ts';
import { seedDemo } from '../src/db/seed-test.ts';
import { MaintenanceService } from '../src/features/maintenance/service.ts';
import { localMaintenanceOptions } from '../src/features/maintenance/options.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';
import type { Database } from '../src/db/mysql.ts';

export const maintenanceActor = { username: 'owner', channel: 'web' as const, traceId: 'maintenance-test' };
export async function maintenanceFixture() {
  const c = await createTestDatabase();
  await seedDemo(c.db, 'maintenance-test-password');
  const options = localMaintenanceOptions({ ...adminConfig(), database: c.name });
  const service = new MaintenanceService(c.db, options);
  return {
    ...c,
    options,
    service,
    dispose: async () => {
      await service.settled();
      await c.dispose();
    },
  };
}
export async function artifactFixture(db: Database, input: { root: string; at: string; content?: string }) {
  const id = await insertBackup(db, maintenanceActor, randomUUID());
  const bytes = Buffer.from(input.content ?? 'synthetic SQL backup');
  await mkdir(input.root, { recursive: true });
  await writeFile(path.join(input.root, `${id}.sql`), bytes, { flag: 'wx' });
  await db.run("UPDATE maintenance_jobs SET status='succeeded',finished_at=UTC_TIMESTAMP(3) WHERE id=?", [id]);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await db.run(
    `INSERT INTO backup_artifacts(id,job_id,path,bytes,sha256,created_at,retention_class)
    VALUES(?,?,?,?,?,?,'daily')`,
    [id, id, `${id}.sql`, bytes.length, sha256, input.at],
  );
  return { id, bytes: bytes.length, sha256 };
}
