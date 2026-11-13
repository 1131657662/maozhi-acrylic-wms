import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { decimalToGrams } from '../src/db/weight.ts';
import { catalogFixture, catalogRowCounts, catalogSnapshot, publish, upload } from './catalog-fixture.ts';

type WebClient = ReturnType<typeof request.agent>;

test('目录只读查询支持搜索、规格聚合、候选轨迹和扫描测试', async () => {
  const fixture = await createReadFixture();
  try {
    const before = await catalogSnapshot(fixture.db);
    const counts = await catalogRowCounts(fixture.db);
    await assertSearch(fixture.web, fixture.currentVersionId, fixture.revision);
    await assertSummary(fixture.web, fixture.db, fixture.currentVersionId);
    await assertTrace(fixture.web, fixture.currentVersionId, fixture.candidateVersionId);
    await assertLookup(fixture.web, fixture.currentVersionId, fixture.revision);
    assert.deepEqual(await catalogRowCounts(fixture.db), counts);
    assert.deepEqual(await catalogSnapshot(fixture.db), before);
  } finally {
    await fixture.dispose();
  }
});

async function createReadFixture() {
  const { db, dispose, app } = await catalogFixture();
  try {
    const rows = Array.from({ length: 51 }, (_, index) => `PAGE SPEC PAGE-${String(index + 1).padStart(3, '0')} 400.0`);
    const current = await upload(
      db,
      [
        'H815B FIBER TRACE-BARCODE-001 300.0',
        'H815B FIBER TRACE-BARCODE-002 301.0',
        'N32 FIBER OTHER-BARCODE-003 350.0',
        ...rows,
      ].join('\n'),
    );
    await publish(db, current.version!.versionId);
    const candidate = await upload(db, 'H815B FIBER TRACE-BARCODE-001 302.0\nNEW FIBER CANDIDATE-BARCODE-004 500.0');
    const web = request.agent(app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    return {
      db,
      dispose,
      web,
      currentVersionId: current.version!.versionId,
      candidateVersionId: candidate.version!.versionId,
      revision: Number((await db.get('SELECT revision FROM catalog_head WHERE id=1'))?.revision),
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}

async function assertSearch(web: WebClient, currentVersionId: number, revision: number) {
  const exact = await web.get('/api/v1/catalog/search').query({ q: 'TRACE-BARCODE-001' }).expect(200);
  assert.equal(exact.body.data.total, 1);
  assert.equal(exact.body.data.items[0].barcode, 'TRACE-BARCODE-001');
  assert.deepEqual(exact.body.data.version, { versionId: currentVersionId, status: 'published', revision });
  const fragment = await web.get('/api/v1/catalog/search').query({ q: 'TRACE-BARCODE-00' }).expect(200);
  assert.equal(fragment.body.data.total, 2);
  const spec = await web.get('/api/v1/catalog/search').query({ q: 'H815B' }).expect(200);
  assert.equal(spec.body.data.total, 2);
  const secondPage = await web.get('/api/v1/catalog/search').query({ q: 'PAGE-', page: 2, pageSize: 50 }).expect(200);
  assert.equal(secondPage.body.data.total, 51);
  assert.equal(secondPage.body.data.items.length, 1);
}

async function assertSummary(web: WebClient, db: Awaited<ReturnType<typeof catalogFixture>>['db'], versionId: number) {
  const result = await web.get('/api/v1/catalog/spec-summary').expect(200);
  const summary = result.body.data.items.find((item: { sourceSpec: string }) => item.sourceSpec === 'H815B FIBER');
  assert.equal(result.body.data.version.versionId, versionId);
  assert.equal(summary.barcodeCount, 2);
  assert.equal(summary.totalWeightGrams, 601000);
  assert.equal(summary.minWeightGrams, 300000);
  assert.equal(summary.maxWeightGrams, 301000);
  assert.equal(summary.averageWeightGrams, 300500);
  const entries = await db.all('SELECT weight_tonnes FROM catalog_entries WHERE version_id=? AND source_spec=?', [
    versionId,
    'H815B FIBER',
  ]);
  const total = entries.reduce((sum, row) => sum + decimalToGrams(row.weight_tonnes), 0);
  assert.equal(summary.totalWeightGrams, total);
}

async function assertTrace(web: WebClient, currentVersionId: number, candidateVersionId: number) {
  const result = await web.get('/api/v1/catalog/barcode-trace').query({ barcode: 'TRACE-BARCODE-001' }).expect(200);
  const trace = result.body.data;
  assert.deepEqual(
    trace.versions.map((version: { versionId: number }) => version.versionId),
    [currentVersionId, candidateVersionId],
  );
  assert.deepEqual(
    trace.versions.map((version: { status: string }) => version.status),
    ['published', 'validated'],
  );
  assert.equal(trace.firstVersionId, currentVersionId);
  assert.equal(trace.lastVersionId, candidateVersionId);
}

async function assertLookup(web: WebClient, currentVersionId: number, revision: number) {
  const found = await web.get('/api/v1/catalog/lookup').query({ barcode: 'TRACE-BARCODE-001' }).expect(200);
  assert.deepEqual(found.body.data, {
    found: true,
    barcode: 'TRACE-BARCODE-001',
    version: { versionId: currentVersionId, status: 'published', revision },
    entry: { sourceSpec: 'H815B FIBER', weightGrams: 300000 },
  });
  const missing = await web.get('/api/v1/catalog/lookup').query({ barcode: 'ABSENT-BARCODE' }).expect(200);
  assert.deepEqual(missing.body.data, {
    found: false,
    barcode: 'ABSENT-BARCODE',
    version: { versionId: currentVersionId, status: 'published', revision },
    entry: null,
  });
}
