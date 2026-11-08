import type { Database } from './mysql.ts';

export async function assertCatalogReady(db: Database): Promise<void> {
  const migration = await db.get("SELECT state FROM schema_migrations WHERE id='006_catalog_versioning'");
  const view = await db.get(
    "SELECT IS_UPDATABLE AS writable FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='scan_catalog'",
  );
  if (migration?.state !== 'applied' || view?.writable !== 'NO')
    throw new Error('目录 006 未完成或 scan_catalog 不是只读视图，拒绝启动写服务；请先核验迁移');
}
