import type { Database } from './mysql.ts';

export async function assertHandoffReady(db: Database): Promise<void> {
  const migration = await db.get("SELECT state FROM schema_migrations WHERE id='007_pda_handoff'");
  const tables = await db.get(`SELECT COUNT(*) AS n FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
    AND TABLE_NAME IN ('pda_handoffs','pda_handoff_records','pda_handoff_clients')`);
  if (migration?.state !== 'applied' || Number(tables?.n) !== 3)
    throw new Error('PDA 交接 007 未完成，拒绝启动写服务；请先核验迁移');
}
