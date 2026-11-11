import { createTestDatabase } from './mysql/test-database.ts';
import type { Database } from '../apps/api/src/db/mysql.ts';

const ROWS = 100_000;
const BATCH = 1000;
const queries = {
  time: "created_at >= '2026-11-05' AND created_at < '2026-11-12'",
  action: "action='action.3' AND created_at >= '2026-11-05' AND created_at < '2026-11-12'",
  object: "target_kind='inbound' AND target_id='object.333'",
  trace: "trace_id='trace.333'",
};
const indexes = {
  time: 'created_at,id',
  action: 'action,created_at,id',
  object: 'target_kind,target_id,created_at,id',
  trace: 'trace_id,created_at,id',
};

async function seed(db: Database): Promise<void> {
  for (let offset = 0; offset < ROWS; offset += BATCH) {
    const rows = Array.from({ length: BATCH }, (_, index) => {
      const n = offset + index;
      const date = new Date(Date.UTC(2026, 7, 4) + (n % 100) * 86400000 + n).toISOString().slice(0, 23).replace('T', ' ');
      return [String(n).padStart(36, '0'), `action.${Math.floor(n / 100) % 20}`, 'inbound', `object.${n % 10000}`, `trace.${Math.floor(n / 3)}`, date, '业务摘要'];
    });
    await db.run(`INSERT INTO audit_index_probe VALUES ${rows.map(() => '(?,?,?,?,?,?,?)').join(',')}`, rows.flat());
  }
  await db.run('ANALYZE TABLE audit_index_probe');
}

async function explain(db: Database, stage: string): Promise<void> {
  for (const [name, predicate] of Object.entries(queries)) {
    const sql = `SELECT id,action,target_id,summary FROM audit_index_probe WHERE ${predicate} ORDER BY created_at DESC,id DESC LIMIT 50`;
    const plan = await db.all('EXPLAIN ' + sql);
    const analysis = await db.all('EXPLAIN ANALYZE ' + sql);
    console.log(JSON.stringify({ stage, name, records: ROWS, plan, analysis }));
  }
}

const c = await createTestDatabase('014_master_code_counters');
try {
  await c.db.run(`CREATE TABLE audit_index_probe (
    id CHAR(36) PRIMARY KEY,action VARCHAR(80) NOT NULL,target_kind VARCHAR(32),
    target_id VARCHAR(100),trace_id VARCHAR(80) NOT NULL,created_at DATETIME(3) NOT NULL,summary VARCHAR(500)
  ) ENGINE=InnoDB`);
  await seed(c.db);
  await explain(c.db, 'before');
  for (const [name, columns] of Object.entries(indexes))
    await c.db.run(`CREATE INDEX probe_${name} ON audit_index_probe(${columns})`);
  await c.db.run('ANALYZE TABLE audit_index_probe');
  await explain(c.db, 'after');
} finally {
  await c.dispose();
}
