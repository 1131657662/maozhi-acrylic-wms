import { randomUUID } from 'node:crypto';
import type { Database } from '../src/db/mysql.ts';
import { actor, fact } from './fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';

export async function frozenOrder(db: Database) {
  await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
  const plan = await recordFact(db, {
    planId: 'DEMO-001',
    fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
    actor,
  });
  return freezePlan(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
}
export async function inventorySnapshot(db: Database) {
  const tables = [
    'inbound_receipts',
    'inbound_lines',
    'outbound_orders',
    'stock',
    'stock_journal',
    'inventory_operations',
    'operation_log',
    'idempotent_commands',
  ];
  const entries = [];
  for (const table of tables) {
    const rows = await db.all(`SELECT * FROM ${table}`);
    entries.push([table, rows.map((row) => JSON.stringify(row)).sort()]);
  }
  return Object.fromEntries(entries);
}
export const adjustment = () => ({
  warehouseCode: 'DEMO-WH',
  productCode: 'ACR-032',
  packagesDelta: -1,
  weightDeltaGrams: -210300,
  expected: { packages: 6, weightGrams: 1800000 },
  reason: '合成验收：复核库存差异',
});
export async function failAfter(db: Database, table: string, event: 'INSERT' | 'UPDATE') {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('Only disposable test databases may inject failures');
  const allowed = [
    'inventory_operations',
    'stock',
    'stock_journal',
    'inbound_receipts',
    'outbound_orders',
    'operation_log',
    'idempotent_commands',
  ];
  if (!allowed.includes(table)) throw new Error('Unsupported failure target');
  await db.run(
    `CREATE TRIGGER b1a_fail AFTER ${event} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B1A injected failure'`,
  );
}
