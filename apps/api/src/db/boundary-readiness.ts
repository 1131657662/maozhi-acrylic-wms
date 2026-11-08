import type { Database } from './mysql.ts';

export async function assertBoundaryReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='010_outbound_memo'");
  if (row?.state !== 'applied') throw new Error('010 出库备注迁移未完成，拒绝启动写服务');
}
