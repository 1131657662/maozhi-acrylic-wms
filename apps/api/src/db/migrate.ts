import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Database } from './mysql.ts';

const migrations = [
  { id: '001_initial', guardedTables: ['idempotent_commands','operation_log','stock_journal','scan_submissions','scan_facts',
    'scan_catalog','stock','outbound_lines','outbound_orders','sessions','owner','app_meta'] },
  { id: '002_inbound_masters', guardedTables: ['inbound_lines','inbound_receipts','master_suppliers','master_customers',
    'master_warehouses','master_products'] },
  { id: '003_source_snapshot', guardedTables: ['scan_catalog','stock_journal','stock','inbound_lines','inbound_receipts',
    'outbound_lines','outbound_orders','master_suppliers','master_customers','master_warehouses','master_products'] },
  { id: '004_document_numbering', guardedTables: ['document_number_counters','document_number_rules'] },
] as const;

function migrationSql(id: string, direction: 'up' | 'down'): string {
  return readFileSync(new URL(`../../migrations/${id}.${direction}.sql`, import.meta.url), 'utf8');
}
async function statements(db: Database, sql: string): Promise<void> {
  for (const statement of sql.replace(/^--.*$/gm, '').split(';').map((line) => line.trim()).filter(Boolean))
    await db.run(statement);
}
async function lockMigration<T>(db: Database, work: (connection: Database) => Promise<T>): Promise<T> {
  return db.withConnection(async (connection) => {
    const name = String((await connection.get('SELECT DATABASE() AS name'))?.name);
    const lock = await connection.get('SELECT GET_LOCK(?,5) AS acquired', [`migrate:${name}`]);
    if (Number(lock?.acquired) !== 1) throw new Error('迁移锁获取失败');
    try {
      await connection.run('SET SESSION lock_wait_timeout=5');
      await connection.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, state VARCHAR(16) NOT NULL,
        applied_at DATETIME(3) NULL) ENGINE=InnoDB`);
      return await work(connection);
    } finally { await connection.get('SELECT RELEASE_LOCK(?)', [`migrate:${name}`]); }
  });
}
export async function migrateUp(db: Database): Promise<void> {
  await lockMigration(db, async (connection) => {
    for (const migration of migrations) {
      const sql = migrationSql(migration.id, 'up');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await connection.get('SELECT checksum,state FROM schema_migrations WHERE id=?', [migration.id]);
      if (previous) {
        if (previous.checksum !== checksum || previous.state !== 'applied') throw new Error(`迁移 ${migration.id} 已变更或中断，须检查后恢复`);
        continue;
      }
      await connection.run('INSERT INTO schema_migrations(id,checksum,state) VALUES(?,?,?)', [migration.id, checksum, 'applying']);
      await statements(connection, sql);
      await connection.run("UPDATE schema_migrations SET state='applied',applied_at=UTC_TIMESTAMP(3) WHERE id=?", [migration.id]);
    }
  });
}
export async function migrateDown(db: Database): Promise<void> {
  await lockMigration(db, async (connection) => {
    for (const migration of [...migrations].reverse()) {
      const previous = await connection.get('SELECT state FROM schema_migrations WHERE id=?', [migration.id]);
      if (!previous) continue;
      if (previous.state !== 'applied') throw new Error(`迁移 ${migration.id} 不完整，拒绝盲目回退`);
      for (const table of migration.guardedTables) {
        if (Number((await connection.get(`SELECT COUNT(*) AS total FROM \`${table}\``))?.total) > 0)
          throw new Error(`拒绝回退：${table} 含有数据，禁止删除历史数据`);
      }
      await connection.run("UPDATE schema_migrations SET state='reverting' WHERE id=?", [migration.id]);
      await statements(connection, migrationSql(migration.id, 'down'));
      await connection.run('DELETE FROM schema_migrations WHERE id=?', [migration.id]);
      return;
    }
  });
}
