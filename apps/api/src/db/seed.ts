import bcrypt from 'bcryptjs';
import type { Database } from './mysql.ts';
import { seedMasters } from './seed-masters.ts';
import { seedScanCatalog } from './seed-catalog.ts';
import { seedHistory } from './seed-history.ts';

export const identity = 'maozhi-local-mysql8-v1';

export async function seedFromSamples(db: Database, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await ensureEmpty(tx);
    const now = '2026-11-07 00:00:00.000';
    await tx.run('INSERT INTO app_meta(meta_key,value) VALUES(?,?)', ['identity', identity]);
    await tx.run('INSERT INTO owner(username,password_hash) VALUES(?,?)', ['owner', passwordHash]);
    await seedMasters(tx, now);
    await seedScanCatalog(tx, now);
    await seedHistory(tx, now);
  });
}

async function ensureEmpty(db: Database): Promise<void> {
  const meta = await db.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
  if (meta) throw new Error('数据库已有种子或业务数据，拒绝覆盖');
  const counts = await db.get(`SELECT
    (SELECT COUNT(*) FROM owner) AS owners,
    (SELECT COUNT(*) FROM master_products) AS products,
    (SELECT COUNT(*) FROM outbound_orders) AS outbound,
    (SELECT COUNT(*) FROM inbound_receipts) AS inbound`);
  if (Object.values(counts ?? {}).some((value) => Number(value) > 0)) throw new Error('数据库非空，拒绝覆盖');
}
