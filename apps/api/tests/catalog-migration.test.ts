import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { seedDemo } from '../src/db/seed-test.ts';
import { rawFactSchema, factSql } from '../src/features/outbound/rows.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmScannedFixture as confirmOutbound } from './fixture.ts';
import { hash } from '../src/shared/hash.ts';
import { actor, fact } from './fixture.ts';
import { gramsToDecimal } from '../src/db/weight.ts';
import { initializeCatalogV1 } from '../src/db/catalog-bootstrap.ts';
import { assertCatalogReady } from '../src/db/catalog-readiness.ts';

test('006 启动校验拒绝未迁移库；已发布零条版本也禁止 down', async () => {
  const { db, dispose } = await createTestDatabase('005_inventory_posting');
  try {
    await assert.rejects(assertCatalogReady(db), /拒绝启动写服务/);
    await migrateUp(db, '006_catalog_versioning');
    await assertCatalogReady(db);
    await initializeCatalogV1(db, []);
    const before = await db.all('SELECT * FROM catalog_versions');
    await assert.rejects(migrateDown(db), /catalog_head 含有数据/);
    assert.deepEqual(await db.all('SELECT * FROM catalog_versions'), before);
    assert.equal(
      (await db.get("SELECT state FROM schema_migrations WHERE id='006_catalog_versioning'"))?.state,
      'applied',
    );
    console.log('B1C1_MIGRATION zero_entry_published_down=refused versions_unchanged=true readiness=passed');
  } finally {
    await dispose();
  }
});

test('006 空库 down/up；旧目录任何 DML 均被数据库拒绝', async () => {
  const { db, dispose } = await createTestDatabase('006_catalog_versioning');
  try {
    await migrateDown(db);
    await migrateUp(db, '006_catalog_versioning');
    console.log('B1C1_MIGRATION empty_down_up=success');
    await seedDemo(db, 'test-only-password');
    const before = await db.all('SELECT * FROM scan_catalog ORDER BY barcode');
    for (const sql of [
      "INSERT INTO scan_catalog(barcode,product_code,weight_tonnes,catalog_version) VALUES('BAD','BAD',1,1)",
      'UPDATE scan_catalog SET weight_tonnes=1',
      'DELETE FROM scan_catalog',
    ]) {
      let output = '';
      try {
        await db.run(sql);
      } catch (error) {
        output = String(error);
      }
      assert.match(output, /not (insertable-into|updatable)/i);
      console.log(`B1C1_READ_ONLY ${sql.split(' ')[0]} ${output}`);
    }
    await assert.rejects(
      db.run(
        "INSERT INTO scan_catalog_v1_archive(barcode,product_code,weight_tonnes,catalog_version) VALUES('BAD','BAD',1,1)",
      ),
      /SCAN_CATALOG_READ_ONLY/,
    );
    assert.deepEqual(await db.all('SELECT * FROM scan_catalog ORDER BY barcode'), before);
    await assert.rejects(migrateDown(db), /拒绝回退/);
    console.log('B1C1_MIGRATION nonempty_down=refused unchanged=true');
  } finally {
    await dispose();
  }
});
test('006 非空 v1 事实/冻结旧单迁移保持正文与摘要，原冻结凭据可确认', async () => {
  const { db, dispose } = await createTestDatabase('005_inventory_posting');
  try {
    await seedDemo(db, 'test-only-password');
    for (const f of [fact(), fact({ barcode: 'DEMO-032-12', weightGrams: 297500 })])
      await db.run(
        `INSERT INTO scan_facts
      (id,plan_id,barcode,weight_tonnes,catalog_version,weight_source,device_id,scanned_at,received_at,recorded_by,payload_hash)
      VALUES(?,'DEMO-001',?,?,1,'catalog',?,'2026-01-01','2026-01-02','owner',?)`,
        [
          f.id,
          f.barcode,
          gramsToDecimal(f.weightGrams),
          f.deviceId,
          hash(JSON.stringify({ planId: 'DEMO-001', fact: f })),
        ],
      );
    const projection = (await db.all(`${factSql} ORDER BY id`)).map((row) => rawFactSchema.parse(row));
    const digest = hash(JSON.stringify(projection));
    await db.run("UPDATE outbound_orders SET status='frozen',revision=3 WHERE id='DEMO-001'");
    await db.run("INSERT INTO scan_submissions VALUES('DEMO-001',?,2,'2026-01-03')", [digest]);
    const facts = await db.all('SELECT * FROM scan_facts ORDER BY id'),
      submissions = await db.all('SELECT * FROM scan_submissions');
    await migrateUp(db);
    assert.deepEqual(await db.all('SELECT * FROM scan_facts ORDER BY id'), facts);
    assert.deepEqual(await db.all('SELECT * FROM scan_submissions'), submissions);
    assert.equal((await getOrder(db, 'DEMO-001')).digest, digest);
    const after = await confirmOutbound(db, {
      planId: 'DEMO-001',
      expected: { revision: 3, digest },
      key: randomUUID(),
      actor,
    });
    assert.equal(after.status, 'confirmed');
    console.log(
      `B1C1_MIGRATION nonempty_facts=2 tonnes=0.6000 facts_unchanged=true digest_unchanged=true old_frozen_confirm=success digest=${digest}`,
    );
  } finally {
    await dispose();
  }
});
