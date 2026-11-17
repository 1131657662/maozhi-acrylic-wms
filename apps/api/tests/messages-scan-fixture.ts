import { randomUUID } from 'node:crypto';
import type { Database } from '../src/db/mysql.ts';
import { sqlDate } from '../src/db/dates.ts';
import { counted } from './stocktake-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { newReceipt } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';

export const oldTime = (now: Date, days: number) => sqlDate(new Date(now.getTime() - days * 86400000).toISOString());
export async function sixMessageSources(db: Database) {
  const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
  const take = (await counted(db, { packages: 200, weightGrams: 60000000 })).stocktake;
  const job = await insertBackup(db, actor, randomUUID());
  const now = new Date(Date.now() + 1000);
  await db.run('UPDATE inbound_receipts SET created_at=? WHERE id=?', [oldTime(now, 1), receipt.id]);
  await db.run("UPDATE outbound_orders SET scan_closed_at=? WHERE id='DEMO-001'", [oldTime(now, 8)]);
  await db.run('UPDATE stocktake_windows SET started_at=? WHERE stocktake_id=?', [oldTime(now, 2), take.id]);
  await db.run(
    'UPDATE catalog_versions SET published_at=? WHERE version_id=(SELECT active_version_id FROM catalog_head WHERE id=1)',
    [oldTime(now, 31)],
  );
  await db.run("UPDATE maintenance_jobs SET status='failed',finished_at=?,error='合成失败' WHERE id=?", [
    sqlDate(now.toISOString()),
    job,
  ]);
  return { receipt, take, job, now };
}
