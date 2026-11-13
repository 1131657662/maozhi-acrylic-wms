import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { backfillSearchText } from '../apps/api/src/features/master-data/search-text-backfill.ts';

const config = developmentConfig();
if (config.database !== 'maozhi_dev_sample') throw new Error('回填仅允许目标开发样本库 maozhi_dev_sample');
const db = openDatabase(config);
try {
  const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
  if (identity?.value !== 'maozhi-local-mysql8-v1') throw new Error('样本开发库身份不匹配');
  const migration = await db.get("SELECT state FROM schema_migrations WHERE id='022_master_search_text'");
  if (migration?.state !== 'applied') throw new Error('022 主数据检索迁移未完成，拒绝回填');
  const counts = await backfillSearchText(db);
  console.log(JSON.stringify({ database: config.database, filledRows: counts }, null, 2));
} finally {
  await db.close();
}
