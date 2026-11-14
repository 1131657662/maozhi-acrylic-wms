import type { Database } from './mysql.ts';

// Compound trigger statements must reach MySQL intact; the marker is part of migration 025's format.
export async function installDiscoveryTriggers(db: Database, sql: string): Promise<void> {
  for (const trigger of sql.split('-- DISCOVERY_TRIGGER').slice(1)) await db.run(trigger.trim());
}
export async function assertStocktakeDiscoveryReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='025_stocktake_discoveries'");
  if (row?.state !== 'applied') throw new Error('025 盘点发现行迁移未完成，拒绝启动写服务');
}
