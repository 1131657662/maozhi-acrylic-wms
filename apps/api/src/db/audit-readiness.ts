import type { Database } from './mysql.ts';
export async function assertAuditReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='015_audit_attempts'");
  if (row?.state !== 'applied') throw new Error('015 操作记录迁移未完成，拒绝启动写服务');
}
