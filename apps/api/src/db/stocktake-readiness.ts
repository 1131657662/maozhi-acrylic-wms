import type { Database } from './mysql.ts';

export async function assertStocktakeReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='009_stocktake'");
  if (row?.state !== 'applied') throw new Error('009 盘点迁移未完成，拒绝启动写服务');
}
