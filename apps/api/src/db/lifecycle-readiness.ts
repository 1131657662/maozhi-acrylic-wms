import type { Database } from './mysql.ts';

export async function assertLifecycleReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='008_document_lifecycle'");
  if (row?.state !== 'applied') throw new Error('008 单据生命周期迁移未完成，拒绝启动写服务');
}
