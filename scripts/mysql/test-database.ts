import { randomBytes } from 'node:crypto';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
import { migrateUp } from '../../apps/api/src/db/migrate.ts';
import { adminDatabase,adminConfig,quoteDatabase } from './local-config.ts';

export async function createTestDatabase() {
  const name=`maozhi_test_${randomBytes(12).toString('hex')}`;
  const admin=await adminDatabase();
  await admin.run(`CREATE DATABASE ${quoteDatabase(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  const db=openDatabase({...adminConfig(),database:name});
  const dispose=async()=>{
    await db.close();
    try { await admin.run(`DROP DATABASE ${quoteDatabase(name)}`); }
    finally { await admin.close(); }
  };
  try { await migrateUp(db); }
  catch(error) { await dispose(); throw error; }
  return {db,name,dispose};
}
