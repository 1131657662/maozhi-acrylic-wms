import { developmentConfig } from '../../apps/api/src/db/config.ts';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
import { migrateUp, migrateDown } from '../../apps/api/src/db/migrate.ts';
const direction = process.argv[2];
if (direction !== 'up' && direction !== 'down') throw new Error('用法: npm run db:migrate -- up|down');
const db = openDatabase(developmentConfig());
try {
  await (direction === 'up' ? migrateUp(db) : migrateDown(db));
  console.log(`MySQL 迁移 ${direction} 完成`);
} finally { await db.close(); }
