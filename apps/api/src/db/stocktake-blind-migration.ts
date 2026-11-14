import type { Database } from './mysql.ts';

export async function guardStocktakeBlindDown(db: Database): Promise<void> {
  const evidence = await db.get("SELECT id FROM stocktakes WHERE mode='blind' OR revealed_at IS NOT NULL LIMIT 1");
  if (evidence) throw new Error('拒绝回退：盘点已有盲盘或揭示证据，禁止删除');
}

export async function assertStocktakeBlindReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='024_stocktake_blind'");
  if (row?.state !== 'applied') throw new Error('024 盲盘迁移未完成，拒绝启动写服务');
}
