import type { Database } from './mysql.ts';
export async function assertMasterReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='012_master_data_snapshots'");
  if (row?.state !== 'applied') throw new Error('012 主数据与单据快照迁移未完成，拒绝启动写服务');
  const numbering = await db.get("SELECT state FROM schema_migrations WHERE id='014_master_code_counters'");
  if (numbering?.state !== 'applied') throw new Error('014 主数据编码迁移未完成，拒绝启动写服务');
  const search = await db.get("SELECT state FROM schema_migrations WHERE id='022_master_search_text'");
  if (search?.state !== 'applied') throw new Error('022 主数据检索迁移未完成，拒绝启动写服务');
}
