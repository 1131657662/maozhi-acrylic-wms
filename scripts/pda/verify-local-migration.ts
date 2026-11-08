import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { developmentConfig } from '../../apps/api/src/db/config.ts';
import { openDatabase, type Database } from '../../apps/api/src/db/mysql.ts';
import { migrateUp } from '../../apps/api/src/db/migrate.ts';
import { assertHandoffReady } from '../../apps/api/src/db/handoff-readiness.ts';
import { adminConfig, adminDatabase, quoteDatabase } from '../mysql/local-config.ts';

const restoreName = process.argv[2];
assert.ok(restoreName && /^maozhi_restore_[a-f0-9]+$/.test(restoreName), 'Provide a separately restored database');
const config = developmentConfig();
assert.equal(config.database, 'maozhi_dev_sample');
quoteDatabase(config.database);
const admin = await adminDatabase();
await admin.close();
const current = openDatabase({ ...adminConfig(), database: config.database });
const restored = openDatabase({ ...adminConfig(), database: restoreName });
try {
  const names = (
    await current.all(`SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`)
  ).map((r) => String(r.name));
  const before = await fingerprints(current, names);
  const rehearsal = await fingerprints(restored, names);
  for (const name of names.filter((n) => n !== 'sessions')) assert.deepEqual(rehearsal[name], before[name], name);
  console.log('B1C2_RESTORE every_original_table=identical sessions=explicitly_cleared_in_restore_only');
  console.log('BEFORE', JSON.stringify(before));
  await migrateUp(current);
  await assertHandoffReady(current);
  const after = await fingerprints(current, names);
  for (const name of names.filter((n) => n !== 'schema_migrations')) assert.deepEqual(after[name], before[name], name);
  console.log('AFTER', JSON.stringify(after));
  console.log('B1C2_LOCAL_007 preexisting_tables=unchanged original_sessions=unchanged new_handoff_tables=empty');
} finally {
  await current.close();
  await restored.close();
}
async function fingerprints(db: Database, names: string[]) {
  const result: Record<string, { count: number; sha: string }> = {};
  for (const name of names) {
    assert.match(name, /^[a-z_][a-z0-9_]*$/);
    const rows = await db.all('SELECT * FROM `' + name + '`');
    const value = JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());
    result[name] = { count: rows.length, sha: createHash('sha256').update(value).digest('hex') };
  }
  return result;
}
