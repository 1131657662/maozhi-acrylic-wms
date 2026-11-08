import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogFixture, upload, publish, fact, actor } from './catalog-fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { factContexts } from '../src/features/scan/notices.ts';

test('同单混版：目录移除旧码、改重后，原事实/摘要不变且仍可冻结确认', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    await db.run("UPDATE outbound_lines SET planned_packages=3,planned_weight_tonnes='0.9000' WHERE id='DEMO-001-L1'");
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    const before = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    const original = await db.all('SELECT * FROM scan_facts ORDER BY id');
    const v = (await upload(db, '新版规格 NEW-C 300\n新版规格 DEMO-032-11 302')).version!;
    await publish(db, v.versionId);
    assert.deepEqual(await db.all('SELECT * FROM scan_facts ORDER BY id'), original);
    assert.equal((await getOrder(db, before.id)).digest, before.digest);
    const mixed = await recordFact(db, {
      planId: before.id,
      fact: fact({ barcode: 'NEW-C', weightGrams: 300000, catalogVersion: v.versionId }),
      context: { outboundLineId: 'DEMO-001-L1', sourceSpec: '新版规格', resolvedAt: null },
      actor,
    });
    assert.deepEqual(mixed.facts.map((f) => f.catalogVersion).sort(), [1, 1, 2]);
    assert.equal(mixed.actualWeightGrams, 900000);
    const frozen = await freezePlan(db, { planId: mixed.id, expected: mixed, key: randomUUID(), actor });
    const empty = (await upload(db, '')).version!;
    await publish(db, empty.versionId);
    assert.equal((await getOrder(db, mixed.id)).digest, frozen.digest);
    const confirmed = await confirmOutbound(db, { planId: mixed.id, expected: frozen, key: randomUUID(), actor });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal((await db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))?.packages, 3);
    console.log(
      'B1C1_MIXED versions=[1,1,2] grams=900000 old_fact_unchanged=true publish_digest_unchanged=true empty_v3_confirm=success',
    );
  } finally {
    await dispose();
  }
});
test('新版先发布仍接受七天以前的历史版事实，差异仅提示，冻结后原 UUID 可重放', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const version = (await upload(db, '变更规格 DEMO-032-11 302')).version!;
    await publish(db, version.versionId);
    const old = fact({ scannedAt: '2020-01-01T00:00:00.000Z' });
    await recordFact(db, { planId: 'DEMO-001', fact: old, actor });
    const plan = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    const notices = await factContexts(db, plan.id, '');
    assert.equal(notices.items.length, 2);
    assert(notices.items.every((n) => n.notice));
    await freezePlan(db, { planId: plan.id, expected: plan, key: randomUUID(), actor });
    assert.equal((await recordFact(db, { planId: plan.id, fact: old, actor })).facts.length, 2);
    await assert.rejects(
      recordFact(db, { planId: 'DEMO-002', fact: fact({ barcode: 'UNKNOWN', catalogVersion: 999 }), actor }),
      { code: 'CATALOG_VERSION_UNAVAILABLE' },
    );
    console.log('B1C1_HISTORICAL old_version_after_publish=accepted age_rejection=0 replay_frozen=success');
  } finally {
    await dispose();
  }
});
