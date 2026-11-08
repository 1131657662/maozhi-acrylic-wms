import type { Database } from './mysql.ts';
import { decimalToGrams } from './weight.ts';
import { initializeCatalogV1 } from './catalog-bootstrap.ts';
import { hash } from '../shared/hash.ts';
import { sqlDate } from './dates.ts';

export async function preflightCatalog(db: Database): Promise<void> {
  await checkCatalogMigrationPrivileges(db);
  const invalid = await db.get(`SELECT COUNT(*) AS n FROM scan_facts f LEFT JOIN scan_catalog c ON c.barcode=f.barcode
    WHERE c.barcode IS NULL OR f.catalog_version<>1 OR f.weight_tonnes<>c.weight_tonnes OR
    (SELECT COUNT(*) FROM outbound_lines l JOIN master_products p ON p.code=l.product_code
     WHERE l.order_id=f.plan_id AND l.product_code=c.product_code AND l.source_del_flag=0 AND p.source_kind='erp-product')<>1`);
  if (Number(invalid?.n) > 0)
    throw new Error(`CATALOG_MIGRATION_NOT_READY: ${invalid?.n} 个旧事实目录/ERP归属异常，未修改历史`);
}
async function checkCatalogMigrationPrivileges(db: Database): Promise<void> {
  const flags = await db.get('SELECT @@log_bin AS binlog,@@log_bin_trust_function_creators AS trusted');
  if (!Number(flags?.binlog) || Number(flags?.trusted)) return;
  const grants = (await db.all('SHOW GRANTS FOR CURRENT_USER')).flatMap((row) => Object.values(row).map(String));
  if (!grants.some((grant) => /GRANT (ALL PRIVILEGES|.*\bSUPER\b.*) ON \*\.\*/.test(grant)))
    throw new Error('006 需要本地迁移管理员创建只读触发器；尚未执行 DDL，禁止为此放宽 binlog 或业务账号权限');
}
export async function migrateCatalogData(db: Database): Promise<void> {
  await db.run('START TRANSACTION');
  try {
    const rows = await db.all('SELECT * FROM scan_catalog ORDER BY barcode');
    const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
    if (rows.length || identity)
      await initializeCatalogV1(
        db,
        rows.map((r) => ({
          barcode: String(r.barcode),
          sourceSpec: r.source_spec === null ? null : String(r.source_spec),
          rawWeightKg: (decimalToGrams(r.weight_tonnes) / 1000).toFixed(1),
          weightGrams: decimalToGrams(r.weight_tonnes),
          legacyProductCode: String(r.product_code),
        })),
      );
    await backfillContexts(db);
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
async function backfillContexts(db: Database): Promise<void> {
  const rows = await db.all(`SELECT f.*,c.source_spec,l.id AS line_id,l.product_code FROM scan_facts f
    JOIN scan_catalog c ON c.barcode=f.barcode JOIN outbound_lines l ON l.order_id=f.plan_id AND l.product_code=c.product_code
    JOIN master_products p ON p.code=l.product_code WHERE l.source_del_flag=0 AND p.source_kind='erp-product' ORDER BY f.id`);
  for (const r of rows) {
    const context = {
      outboundLineId: String(r.line_id),
      sourceSpec: r.source_spec === null ? null : String(r.source_spec),
      resolvedAt: null,
    };
    await db.run(
      `INSERT INTO scan_fact_context(fact_id,catalog_version_id,barcode,outbound_line_id,erp_product_code,source_spec,weight_tonnes,resolved_at,binding_source,context_hash)
      VALUES(?,?,?,?,?,?,?,NULL,'migration-exact',?)`,
      [
        String(r.id),
        1,
        String(r.barcode),
        context.outboundLineId,
        String(r.product_code),
        context.sourceSpec,
        String(r.weight_tonnes),
        hash(JSON.stringify(context)),
      ],
    );
    await db.run(
      `INSERT INTO catalog_client_activity(client_key,legacy_requests,queue_verified,last_seen_at) VALUES(?,0,0,?)
      ON DUPLICATE KEY UPDATE last_seen_at=VALUES(last_seen_at)`,
      [`device:${r.device_id}`, sqlDate(new Date().toISOString())],
    );
  }
}
