import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Database } from './mysql.ts';
import { preflightCatalog, migrateCatalogData } from './catalog-migration.ts';
import { prepareStocktakeDown } from './stocktake-migration.ts';
import { guardCorrectionDown } from './correction-migration.ts';
import { migrateProductEligibility } from './product-eligibility.ts';
import { guardScanWorkbenchDown } from './scan-workbench-migration.ts';
import { guardSearchTextDown } from './search-text-migration.ts';

const migrations = [
  {
    id: '001_initial',
    guardedTables: [
      'idempotent_commands',
      'operation_log',
      'stock_journal',
      'scan_submissions',
      'scan_facts',
      'scan_catalog',
      'stock',
      'outbound_lines',
      'outbound_orders',
      'sessions',
      'owner',
      'app_meta',
    ],
  },
  {
    id: '002_inbound_masters',
    guardedTables: [
      'inbound_lines',
      'inbound_receipts',
      'master_suppliers',
      'master_customers',
      'master_warehouses',
      'master_products',
    ],
  },
  {
    id: '003_source_snapshot',
    guardedTables: [
      'scan_catalog',
      'stock_journal',
      'stock',
      'inbound_lines',
      'inbound_receipts',
      'outbound_lines',
      'outbound_orders',
      'master_suppliers',
      'master_customers',
      'master_warehouses',
      'master_products',
    ],
  },
  { id: '004_document_numbering', guardedTables: ['document_number_counters', 'document_number_rules'] },
  { id: '005_inventory_posting', guardedTables: ['inventory_operations', 'inbound_receipts', 'stock_journal'] },
  {
    id: '006_catalog_versioning',
    guardedTables: [
      'scan_fact_context',
      'catalog_entries',
      'catalog_head',
      'catalog_versions',
      'catalog_client_activity',
      'scan_facts',
      'scan_catalog_v1_archive',
    ],
  },
  { id: '007_pda_handoff', guardedTables: ['pda_handoff_clients', 'pda_handoff_records', 'pda_handoffs'] },
  {
    id: '008_document_lifecycle',
    guardedTables: [
      'document_closures',
      'outbound_plan_exposures',
      'inventory_operations',
      'inbound_receipts',
      'outbound_orders',
      'stock_journal',
    ],
  },
  {
    id: '009_stocktake',
    guardedTables: ['stocktakes', 'stocktake_snapshots', 'stocktake_readings', 'stocktake_windows'],
  },
  { id: '010_outbound_memo', guardedTables: [] },
  { id: '011_corrections_business_date', guardedTables: [] },
  {
    id: '012_master_data_snapshots',
    guardedTables: [
      'product_eligibility_migration',
      'vehicle_document_uses',
      'master_vehicles',
      'party_contact_defaults',
      'party_contacts',
      'master_product_categories',
      'master_products',
      'master_warehouses',
      'master_customers',
      'master_suppliers',
      'inbound_lines',
      'inbound_receipts',
      'outbound_lines',
      'outbound_orders',
      'operation_log',
    ],
  },
  { id: '013_list_preferences', guardedTables: ['user_list_preferences'] },
  {
    id: '014_master_code_counters',
    guardedTables: [
      'master_code_counters',
      'master_customers',
      'master_suppliers',
      'master_warehouses',
      'document_number_rules',
    ],
  },
  { id: '015_audit_attempts', guardedTables: ['operation_attempts', 'operation_log'] },
  {
    id: '016_outbound_shipments',
    guardedTables: ['outbound_shipment_lines', 'outbound_shipments', 'document_correction_lines'],
  },
  { id: '017_document_extra_fields', guardedTables: [] },
  { id: '018_scan_workbench', guardedTables: [] },
  { id: '019_shipment_close', guardedTables: [] },
  { id: '020_correction_shipment_line', guardedTables: [] },
  { id: '021_document_date_corrections', guardedTables: ['document_date_corrections'] },
  { id: '022_master_search_text', guardedTables: [] },
] as const;

function migrationSql(id: string, direction: 'up' | 'down'): string {
  return readFileSync(new URL(`../../migrations/${id}.${direction}.sql`, import.meta.url), 'utf8');
}
function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}
function migrationChecksumMatches(sql: string, checksum: string): boolean {
  const lf = sql.replace(/\r\n/g, '\n');
  const crlf = lf.replace(/\n/g, '\r\n');
  return [sql, lf, crlf].some((value) => createHash('sha256').update(value).digest('hex') === checksum);
}
async function statements(db: Database, sql: string): Promise<void> {
  for (const statement of sql
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((line) => line.trim())
    .filter(Boolean))
    await db.run(statement);
}
async function lockMigration<T>(
  db: Database,
  work: (connection: Database) => Promise<T>,
  initialize = true,
): Promise<T> {
  return db.withConnection(async (connection) => {
    const name = String((await connection.get('SELECT DATABASE() AS name'))?.name);
    const lock = await connection.get('SELECT GET_LOCK(?,5) AS acquired', [`migrate:${name}`]);
    if (Number(lock?.acquired) !== 1) throw new Error('迁移锁获取失败');
    try {
      await connection.run('SET SESSION lock_wait_timeout=5');
      if (initialize)
        await connection.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, state VARCHAR(16) NOT NULL,
        applied_at DATETIME(3) NULL) ENGINE=InnoDB`);
      return await work(connection);
    } finally {
      await connection.get('SELECT RELEASE_LOCK(?)', [`migrate:${name}`]);
    }
  });
}
export async function migrateUp(db: Database, through?: string): Promise<void> {
  await lockMigration(db, async (connection) => {
    for (const migration of migrations) {
      if (through && migration.id > through) break;
      const sql = migrationSql(migration.id, 'up');
      const checksum = migrationChecksum(sql);
      const previous = await connection.get('SELECT checksum,state FROM schema_migrations WHERE id=?', [migration.id]);
      if (previous) {
        if (!migrationChecksumMatches(sql, String(previous.checksum)) || previous.state !== 'applied')
          throw new Error(`迁移 ${migration.id} 已变更或中断，须检查后恢复`);
        continue;
      }
      if (migration.id === '006_catalog_versioning') await preflightCatalog(connection);
      await connection.run('INSERT INTO schema_migrations(id,checksum,state) VALUES(?,?,?)', [
        migration.id,
        checksum,
        'applying',
      ]);
      if (migration.id === '006_catalog_versioning') {
        const [structure, finalize] = sql.split('-- CATALOG_V1_FINALIZE');
        await statements(connection, structure!);
        await migrateCatalogData(connection);
        await statements(connection, finalize!);
      } else await statements(connection, sql);
      if (migration.id === '012_master_data_snapshots') await migrateProductEligibility(connection);
      await connection.run("UPDATE schema_migrations SET state='applied',applied_at=UTC_TIMESTAMP(3) WHERE id=?", [
        migration.id,
      ]);
    }
  });
}
export async function migrateDown(db: Database): Promise<void> {
  await lockMigration(
    db,
    async (connection) => {
      if (!(await connection.get("SHOW TABLES LIKE 'schema_migrations'"))) return;
      for (const migration of [...migrations].reverse()) {
        const previous = await connection.get('SELECT state FROM schema_migrations WHERE id=?', [migration.id]);
        if (!previous) continue;
        if (previous.state !== 'applied') throw new Error(`迁移 ${migration.id} 不完整，拒绝盲目回退`);
        if (migration.id === '022_master_search_text') await guardSearchTextDown(connection);
        if (
          migration.id === '020_correction_shipment_line' &&
          (await connection.get(
            'SELECT correction_id FROM document_correction_lines WHERE shipment_line_id IS NOT NULL LIMIT 1',
          ))
        )
          throw new Error('拒绝回退：更正已有发货行归属，禁止删除');
        if (
          migration.id === '019_shipment_close' &&
          (await connection.get(`SELECT id FROM outbound_orders
          WHERE short_closed_at IS NOT NULL OR short_close_reason IS NOT NULL
          OR short_closed_packages IS NOT NULL OR short_closed_grams IS NOT NULL LIMIT 1`))
        )
          throw new Error('拒绝回退：单据已有短关证据，禁止删除');
        if (migration.id === '018_scan_workbench') await guardScanWorkbenchDown(connection);
        if (
          migration.id === '016_outbound_shipments' &&
          (await connection.get('SELECT id FROM outbound_orders WHERE scan_closed_at IS NOT NULL LIMIT 1'))
        )
          throw new Error('拒绝回退：outbound_orders 含有结束扫码记录');
        if (
          migration.id === '016_outbound_shipments' &&
          (await connection.get(
            'SELECT id FROM outbound_lines WHERE scan_packages IS NOT NULL OR scan_weight_grams IS NOT NULL OR line_position<>0 LIMIT 1',
          ))
        )
          throw new Error('拒绝回退：outbound_lines 含有发货快照或行序数据');
        if (
          migration.id === '017_document_extra_fields' &&
          (await connection.get(`
            SELECT id FROM inbound_receipts WHERE bill_type IS NOT NULL OR container_no IS NOT NULL
            UNION ALL SELECT id FROM inbound_lines WHERE memo IS NOT NULL
            UNION ALL SELECT id FROM outbound_orders WHERE bill_type IS NOT NULL OR container_no IS NOT NULL
            UNION ALL SELECT id FROM outbound_lines WHERE contract_no IS NOT NULL OR memo IS NOT NULL
            LIMIT 1
          `))
        )
          throw new Error('拒绝回退：单据扩展字段已有数据，禁止删除');
        if (migration.id === '011_corrections_business_date') await guardCorrectionDown(connection);
        if (
          migration.id === '010_outbound_memo' &&
          (await connection.get('SELECT id FROM outbound_orders WHERE memo IS NOT NULL LIMIT 1'))
        )
          throw new Error('拒绝回退：outbound_orders.memo 含有数据，禁止删除备注');
        for (const table of migration.guardedTables) {
          if (Number((await connection.get(`SELECT COUNT(*) AS total FROM \`${table}\``))?.total) > 0)
            throw new Error(`拒绝回退：${table} 含有数据，禁止删除历史数据`);
        }
        await connection.run("UPDATE schema_migrations SET state='reverting' WHERE id=?", [migration.id]);
        if (migration.id === '009_stocktake') await prepareStocktakeDown(connection);
        await statements(connection, migrationSql(migration.id, 'down'));
        await connection.run('DELETE FROM schema_migrations WHERE id=?', [migration.id]);
        return;
      }
    },
    false,
  );
}
