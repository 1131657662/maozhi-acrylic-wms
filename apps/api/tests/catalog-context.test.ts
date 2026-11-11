import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogFixture, fact, actor, upload, publish, catalogSnapshot } from './catalog-fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { confirmScannedFixture as confirmOutbound } from './fixture.ts';
import { versionEntries } from '../src/features/catalog/read.ts';
import type { Database } from '../src/db/mysql.ts';

function forbidCatalogReads(db: Database): Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'transaction')
        return <T>(work: (tx: Database) => Promise<T>) => target.transaction((tx) => work(forbidCatalogReads(tx)));
      if (prop === 'all' || prop === 'get')
        return (sql: string, ...args: unknown[]) => {
          assert.doesNotMatch(sql, /\b(catalog_entries|catalog_versions|catalog_head|scan_catalog)\b/i);
          return Reflect.apply(target[prop], target, [sql, ...args]);
        };
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
test('冻结与确认查询不读取任何目录表；跨版去重与上下文冲突保持原事实', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const input = fact(),
      context = { outboundLineId: 'DEMO-001-L1', sourceSpec: '合成规格', resolvedAt: null };
    await recordFact(db, { planId: 'DEMO-001', fact: input, context, actor });
    const before = await catalogSnapshot(db);
    await assert.rejects(
      recordFact(db, {
        planId: 'DEMO-001',
        fact: input,
        context: { ...context, resolvedAt: new Date().toISOString() },
        actor,
      }),
      { code: 'IDEMPOTENCY_CONFLICT' },
    );
    const version = (await upload(db, '合成规格 DEMO-032-11 302.5\n合成规格 DEMO-032-12 297.5')).version!;
    await publish(db, version.versionId);
    await assert.rejects(
      recordFact(db, {
        planId: 'DEMO-002',
        fact: fact({ catalogVersion: 2 }),
        context: { ...context, outboundLineId: 'DEMO-002-L1' },
        actor,
      }),
      { code: 'DUPLICATE_BARCODE' },
    );
    assert.deepEqual((await catalogSnapshot(db)).scan_facts, before.scan_facts);
    const detail = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500, catalogVersion: 2 }),
      context,
      actor,
    });
    const frozen = await freezePlan(forbidCatalogReads(db), {
      planId: detail.id,
      expected: detail,
      key: randomUUID(),
      actor,
    });
    assert.equal(
      (await confirmOutbound(forbidCatalogReads(db), { planId: detail.id, expected: frozen, key: randomUUID(), actor }))
        .status,
      'confirmed',
    );
    console.log('B1C1_CONTEXT same_uuid_changed_context=409 cross_version_barcode=409 freeze_confirm_catalog_reads=0');
  } finally {
    await dispose();
  }
});
test('下载固定版本分页过程中发布新版仍返回原版完整清单', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const first = await versionEntries(db, { versionId: 1, after: '', limit: 1 });
    await publish(db, (await upload(db, '另版规格 NEXT-A 350')).version!.versionId);
    const rest = await versionEntries(db, { versionId: 1, after: first.nextBarcode!, limit: 100 });
    assert.equal(first.contentSha256, rest.contentSha256);
    assert.equal(first.items.length + rest.items.length, first.entryCount);
    assert.equal(new Set([...first.items, ...rest.items].map((e) => e.barcode)).size, first.entryCount);
    assert([...first.items, ...rest.items].every((e) => e.catalogVersion === 1));
  } finally {
    await dispose();
  }
});
