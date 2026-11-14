import { developmentConfig } from './db/config.ts';
import { openDatabase } from './db/mysql.ts';
import { createApp } from './app.ts';
import { logger } from './shared/logger.ts';
import { assertCatalogReady } from './db/catalog-readiness.ts';

import { assertHandoffReady } from './db/handoff-readiness.ts';
import { assertLifecycleReady } from './db/lifecycle-readiness.ts';
import { assertStocktakeReady } from './db/stocktake-readiness.ts';
import { assertStocktakeBlindReady } from './db/stocktake-blind-migration.ts';
import { assertStocktakeDiscoveryReady } from './db/stocktake-discovery-migration.ts';
import { assertBoundaryReady } from './db/boundary-readiness.ts';
import { assertCorrectionsReady } from './db/correction-migration.ts';
import { assertMasterReady } from './db/master-readiness.ts';
import { assertAuditReady } from './db/audit-readiness.ts';

const db = openDatabase(developmentConfig());
const meta = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
if (meta?.value !== 'maozhi-local-mysql8-v1') {
  await db.close();
  throw new Error('开发库身份不匹配，请执行 npm run db:setup');
}
const version = await db.get('SELECT VERSION() AS version');
if (!String(version?.version).startsWith('8.')) {
  await db.close();
  throw new Error('开发库必须是MySQL 8');
}
try {
  await assertCatalogReady(db);
  if (
    (await db.get("SELECT state FROM schema_migrations WHERE id='023_catalog_candidate_abandons'"))?.state !== 'applied'
  )
    throw new Error('023 候选放弃迁移未完成，拒绝启动写服务');
  await assertHandoffReady(db);
  await assertLifecycleReady(db);
  await assertStocktakeReady(db);
  await assertStocktakeBlindReady(db);
  await assertStocktakeDiscoveryReady(db);
  await assertBoundaryReady(db);
  await assertCorrectionsReady(db);
  await assertMasterReady(db);
  await assertAuditReady(db);
  if (
    (await db.get("SELECT state FROM schema_migrations WHERE id='021_document_date_corrections'"))?.state !== 'applied'
  )
    throw new Error('021 日期更正迁移未完成，拒绝启动写服务');
  if ((await db.get("SELECT state FROM schema_migrations WHERE id='016_outbound_shipments'"))?.state !== 'applied')
    throw new Error('016 发货记录迁移未完成，拒绝启动写服务');
} catch (error) {
  await db.close();
  throw error;
}
const server = createApp(db).listen(4310, '127.0.0.1', () => logger.info('MySQL 开发 API: http://127.0.0.1:4310'));
function shutdown(): void {
  server.close(() => {
    void db.close().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
