import type { Database } from './mysql.ts';
export async function assertMasterReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='012_master_data_snapshots'");
  if (row?.state !== 'applied') throw new Error('012 主数据与单据快照迁移未完成，拒绝启动写服务');
}
