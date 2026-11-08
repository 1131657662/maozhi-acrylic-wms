import { randomUUID } from 'node:crypto';
import type { LifecycleKind } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';
import { actor } from './fixture.ts';
import { newReceipt } from './numbering-fixture.ts';
import { frozenOrder } from './inventory-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { lifecyclePreview } from '../src/features/document-lifecycle/preview.ts';
import { hash } from '../src/shared/hash.ts';

export async function prepared(db: Database, kind: LifecycleKind) {
  if (kind === 'inbound') {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    await confirmInbound(db, receipt.id, randomUUID(), actor);
    return { kind, id: receipt.id };
  }
  const plan = await frozenOrder(db);
  await confirmOutbound(db, { planId: plan.id, expected: plan, key: randomUUID(), actor });
  return { kind, id: plan.id };
}
export async function commandFor(
  db: Database,
  target: { kind: LifecycleKind; id: string },
  action: 'reverse' | 'void' = 'reverse',
) {
  const preview = await lifecyclePreview(db, target);
  return {
    ...target,
    action,
    key: randomUUID(),
    actor,
    input: { reason: '隔离验收：误确认纠正', expectedToken: preview.token },
  };
}
export async function businessFingerprint(db: Database) {
  const tables = (await db.all('SHOW FULL TABLES WHERE Table_type="BASE TABLE"'))
    .map((r) => String(Object.values(r)[0]))
    .sort();
  const fingerprints: Record<string, string> = {};
  for (const table of tables) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error('Unexpected table name');
    fingerprints[table] = hash(
      JSON.stringify((await db.all(`SELECT * FROM \`${table}\``)).map((r) => JSON.stringify(r)).sort()),
    );
  }
  return fingerprints;
}
export async function injectLifecycleFailure(db: Database, table: string, event: 'INSERT' | 'UPDATE') {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('Only disposable test DBs may inject failure');
  const allowed = [
    'inventory_operations',
    'stock',
    'stock_journal',
    'inbound_receipts',
    'outbound_orders',
    'document_closures',
    'operation_log',
    'idempotent_commands',
  ];
  if (!allowed.includes(table)) throw new Error('Unsupported fault target');
  await db.run(
    `CREATE TRIGGER b2a_fail AFTER ${event} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B2A injected failure'`,
  );
}
export async function netDelta(db: Database) {
  return db.all(`SELECT c.action,o.operation_type,COUNT(DISTINCT c.id) AS closures,
    SUM(j.packages_delta) AS packages_net,SUM(j.tonnes_delta) AS tonnes_net
    FROM document_closures c JOIN inventory_operations o ON o.id=c.original_operation_id
    JOIN stock_journal j ON j.operation_id=c.original_operation_id OR j.operation_id=c.compensation_operation_id
    WHERE c.action='reverse' GROUP BY c.action,o.operation_type`);
}
