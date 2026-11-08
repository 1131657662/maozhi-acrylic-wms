import { randomUUID } from 'node:crypto';
import { factInputSchema, type FactInput } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';
import { fact, actor } from './fixture.ts';
import { hash } from '../src/shared/hash.ts';
import { readEntries } from '../src/features/catalog/repository.ts';
import { contentHash } from '../src/features/catalog/hash.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { noteLegacyClient } from '../src/features/catalog/gate.ts';

export const handoffPlan = 'pda-handoff-plan',
  handoffLine = 'pda-handoff-line';
export async function prepareHandoff(db: Database, original?: { payload: string; state: string }[]) {
  if (!/^maozhi_test_[a-f0-9]+$/.test(String((await db.get('SELECT DATABASE() AS n'))?.n)))
    throw new Error('Disposable DB only');
  await db.run(`INSERT INTO master_products(code,name,active,created_at,updated_at,source_kind,source_del_flag)
    VALUES('TEST-ERP','隔离验证商品',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'erp-product',0)`);
  await db.run(
    "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag) VALUES('DEMO-WH','TEST-ERP',500,'150.0000',0)",
  );
  for (const [id, line, count, weight] of [
    [handoffPlan, handoffLine, 61, '18.3020'],
    ['pda-offline-plan', 'pda-offline-line', 102, '30.6000'],
  ] as const) {
    await db.run(
      `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,created_at,status,source_del_flag)
      VALUES(?,?,'隔离验证','DEMO-CUST-1','DEMO-WH','TEST',UTC_TIMESTAMP(3),'open',0)`,
      [id, id],
    );
    await db.run(
      `INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_del_flag)
      VALUES(?,?,'TEST-ERP','隔离验证商品',?,?,0)`,
      [line, id, count, weight],
    );
  }
  for (const [prefix, n] of [
    ['HANDOFF', 60],
    ['OFFLINE', 102],
  ] as const)
    for (let i = 1; i <= n; i++)
      await db.run(
        `INSERT INTO catalog_entries(version_id,barcode,legacy_product_code,source_spec,raw_weight_kg,weight_tonnes)
      VALUES(1,?,NULL,'交接规格','300','0.3000')`,
        [`${prefix}-${String(i).padStart(3, '0')}`],
      );
  const entries = await readEntries(db, 1);
  await db.run('UPDATE catalog_versions SET entry_count=?,spec_count=?,content_sha256=? WHERE version_id=1', [
    entries.length,
    new Set(entries.map((e) => e.sourceSpec)).size,
    contentHash(entries),
  ]);
  const records =
    original ??
    Array.from({ length: 60 }, (_, i) => ({
      payload: JSON.stringify(
        fact({ barcode: `HANDOFF-${String(i + 1).padStart(3, '0')}`, weightGrams: 300000, deviceId: 'handoff-device' }),
      ),
      state: i < 55 ? 'pending' : 'failed',
    }));
  const facts = records.map((r) => factInputSchema.parse(JSON.parse(r.payload)));
  for (const f of facts.slice(-2))
    await recordFact(db, {
      planId: handoffPlan,
      fact: f,
      actor,
      context: { outboundLineId: handoffLine, sourceSpec: '交接规格', resolvedAt: null },
    });
  await noteLegacyClient(db, `device:${facts[0]!.deviceId}`);
  return { facts, records, header: handoffHeader(records, facts, contentHash(entries)) };
}
function handoffHeader(records: { payload: string; state: string }[], facts: FactInput[], sha: string) {
  const manifest = records
    .map((r, i) => [facts[i]!.id, handoffPlan, hash(r.payload)])
    .sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
  return {
    id: randomUUID(),
    deviceId: facts[0]!.deviceId,
    appVersion: 'test-v2',
    expectedCount: records.length,
    manifestSha: hash(JSON.stringify(manifest)),
    catalogVersion: 1,
    catalogSha: sha,
    previousSessionHashes: [],
  };
}
