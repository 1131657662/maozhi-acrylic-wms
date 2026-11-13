import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { catalogDiffQuerySchema } from '@wms/contracts';
import { assertCatalogExportLimit } from '../src/features/catalog/export.ts';
import { catalogFixture, catalogSnapshot, publish, upload } from './catalog-fixture.ts';

test('目录版本对比返回各类变化并按条码分页', async () => {
  const f = await apiFixture();
  try {
    const before = await catalogSnapshot(f.db);
    const first = await f.web
      .get(`/api/v1/catalog/versions/${f.candidate}/diff`)
      .query({ against: f.base, limit: 2 })
      .expect(200);
    const next = await f.web
      .get(`/api/v1/catalog/versions/${f.candidate}/diff`)
      .query({
        against: f.base,
        afterBarcode: first.body.data.items.at(-1).barcode,
        limit: 2,
      })
      .expect(200);
    const last = await f.web
      .get(`/api/v1/catalog/versions/${f.candidate}/diff`)
      .query({ against: f.base, afterBarcode: next.body.data.items.at(-1).barcode, limit: 2 })
      .expect(200);
    const all = [...first.body.data.items, ...next.body.data.items, ...last.body.data.items];
    assert.equal(first.body.data.total, 5);
    assert.deepEqual(
      all.map((row) => row.barcode),
      ['ADDED-E', 'REMOVED-C', 'SPEC-B', 'STABLE-D', 'WEIGHT-A'],
    );
    assert.deepEqual(new Set(all.map((row) => row.kind)), new Set(['added', 'removed', 'changed', 'unchanged']));
    assert.equal(all.find((row) => row.barcode === 'WEIGHT-A')?.weightChanged, true);
    assert.equal(all.find((row) => row.barcode === 'SPEC-B')?.specChanged, true);
    const defaultBase = await f.web.get(`/api/v1/catalog/versions/${f.candidate}/diff`).expect(200);
    assert.equal(defaultBase.body.data.baseVersionId, f.base);
    assert.deepEqual(await catalogSnapshot(f.db), before);
  } finally {
    await f.dispose();
  }
});

test('目录版本对比区分不存在版本与尚未校验版本', async () => {
  const f = await apiFixture();
  try {
    await f.web.get(`/api/v1/catalog/versions/${f.candidate}/diff`).query({ against: 999999 }).expect(404);
    const staged = await upload(f.db, '暂存 STAGED-A 300');
    await f.db.run("UPDATE catalog_versions SET status='staging' WHERE version_id=?", [staged.version!.versionId]);
    await f.web
      .get(`/api/v1/catalog/versions/${f.candidate}/diff`)
      .query({ against: staged.version!.versionId })
      .expect(422);
    await f.web.get(`/api/v1/catalog/versions/${staged.version!.versionId}/diff`).expect(422);
  } finally {
    await f.dispose();
  }
});

test('目录 XLSX 导出完整搜索命中集且固定当前版本', async () => {
  const f = await apiFixture(true);
  try {
    const before = await catalogSnapshot(f.db);
    const screen = await f.web.get('/api/v1/catalog/search').query({ q: 'EXPORT-' }).expect(200);
    const response = await f.web
      .get('/api/v1/catalog/export')
      .query({ q: 'EXPORT-', versionId: f.base })
      .buffer(true)
      .parse(readBuffer)
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);
    const sheet = workbook.getWorksheet('导出记录')!;
    assert.equal(sheet.rowCount, screen.body.data.total + 2);
    assert.equal(screen.body.data.items.length, 50);
    assert.equal(screen.body.data.total, 53);
    const header = sheet.getRow(1).values;
    assert.ok(Array.isArray(header));
    assert.deepEqual(header.slice(1), ['条码', '规格', '重量（千克）', '版本']);
    assert.equal(sheet.getRow(2).getCell(1).value, screen.body.data.items[0].barcode);
    assert.equal(sheet.getRow(2).getCell(4).value, `第 ${f.base} 版`);
    await f.web
      .get('/api/v1/catalog/export')
      .query({ q: '', versionId: f.base + 1 })
      .expect(409);
    assert.deepEqual(await catalogSnapshot(f.db), before);
  } finally {
    await f.dispose();
  }
});

test('目录 XLSX 导出允许10万行并拒绝第100001行', () => {
  assert.equal(assertCatalogExportLimit(100_000), undefined);
  assert.throws(() => assertCatalogExportLimit(100_001), { code: 'EXPORT_TOO_LARGE', status: 422 });
});

test('两版差异查询参数使用正整数版本及有界分页', () => {
  assert.equal(catalogDiffQuerySchema.parse({ against: '4' }).against, 4);
  assert.throws(() => catalogDiffQuerySchema.parse({ against: '0' }));
  assert.throws(() => catalogDiffQuerySchema.parse({ limit: '1001' }));
});

async function apiFixture(withManyRows = false) {
  const { db, app, dispose } = await catalogFixture();
  const baseText = withManyRows
    ? Array.from({ length: 53 }, (_, index) => `EXPORT-SPEC EXPORT-${String(index).padStart(3, '0')} 300.0`).join('\n')
    : ['旧规格 WEIGHT-A 300.0', '旧规格 SPEC-B 300.0', '旧规格 REMOVED-C 300.0', '旧规格 STABLE-D 300.0'].join('\n');
  const baseUpload = await upload(db, baseText);
  await publish(db, baseUpload.version!.versionId);
  const candidateUpload = await upload(
    db,
    withManyRows
      ? 'EXPORT-SPEC EXPORT-000 300.0\nEXPORT-SPEC EXPORT-001 300.0\nEXPORT-SPEC EXPORT-002 300.0'
      : ['旧规格 WEIGHT-A 301.0', '新规格 SPEC-B 300.0', '旧规格 STABLE-D 300.0', '新规格 ADDED-E 300.0'].join('\n'),
  );
  const web = request.agent(app);
  await web
    .post('/api/v1/auth/login')
    .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
    .expect(200);
  return { db, dispose, web, base: baseUpload.version!.versionId, candidate: candidateUpload.version!.versionId };
}
function readBuffer(response: request.Response, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}
