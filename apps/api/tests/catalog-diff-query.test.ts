import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { catalogDiffQuerySchema } from '@wms/contracts';
import { catalogFixture, catalogSnapshot, upload } from './catalog-fixture.ts';
import { queryVersionDiff } from '../src/features/catalog/diff-query.ts';
import { catalogDiff } from '../src/features/catalog/diff.ts';
import { readEntries } from '../src/features/catalog/repository.ts';

test('任意两版查询与既有差异计算一致，双重变化两个标志均保留', async (t) => {
  const { db, dispose } = await catalogFixture();
  t.after(dispose);
  const base = (await upload(db, 'case BOTH 300\n保留 SAME 200\n移出 OLD 100')).version!;
  const next = (await upload(db, 'Case BOTH 301\n保留 SAME 200\n新增 NEW 100')).version!;
  assert.notEqual(next.baseVersionId, base.versionId);
  const before = await catalogSnapshot(db);
  const expected = catalogDiff(await readEntries(db, base.versionId), await readEntries(db, next.versionId));
  const result = await queryVersionDiff(db, {
    versionId: next.versionId,
    ...catalogDiffQuerySchema.parse({ against: base.versionId }),
  });
  assert.deepEqual(result.items, expected);
  assert.deepEqual(
    result.items.find((row) => row.barcode === 'BOTH'),
    {
      barcode: 'BOTH',
      kind: 'changed',
      oldSpec: 'case',
      newSpec: 'Case',
      oldWeightGrams: 300000,
      newWeightGrams: 301000,
      weightChanged: true,
      specChanged: true,
    },
  );
  for (const kind of ['weight', 'spec', 'changed']) {
    const page = await queryVersionDiff(db, {
      versionId: next.versionId,
      ...catalogDiffQuerySchema.parse({ against: base.versionId, kind }),
    });
    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.barcode, 'BOTH');
  }
  assert.deepEqual(await catalogSnapshot(db), before);
});

test('反向对比交换新增消失，同版对比全部未变化，首版默认空基线', async (t) => {
  const { db, dispose } = await catalogFixture();
  t.after(dispose);
  const base = (await upload(db, '原规格 OLD 300')).version!;
  const next = (await upload(db, '新规格 NEW 300')).version!;
  const reverse = await queryVersionDiff(db, {
    versionId: base.versionId,
    ...catalogDiffQuerySchema.parse({ against: next.versionId }),
  });
  assert.deepEqual(
    reverse.items.map((row) => [row.barcode, row.kind]),
    [
      ['NEW', 'removed'],
      ['OLD', 'added'],
    ],
  );
  const same = await queryVersionDiff(db, {
    versionId: base.versionId,
    ...catalogDiffQuerySchema.parse({ against: base.versionId }),
  });
  assert.deepEqual(
    same.items.map((row) => row.kind),
    ['unchanged'],
  );
  const initial = await queryVersionDiff(db, { versionId: 1, ...catalogDiffQuerySchema.parse({}) });
  assert.equal(initial.baseVersionId, null);
  assert.ok(initial.items.every((row) => row.kind === 'added'));
  const emptyPage = await queryVersionDiff(db, {
    versionId: base.versionId,
    ...catalogDiffQuerySchema.parse({ against: base.versionId, afterBarcode: 'OLD' }),
  });
  assert.deepEqual(emptyPage.items, []);
  assert.equal(emptyPage.total, 1);
});

test('目录导出和差异接口保留身份与Web渠道限制', async (t) => {
  const { app, dispose } = await catalogFixture();
  t.after(dispose);
  for (const path of ['/api/v1/catalog/export?versionId=1', '/api/v1/catalog/versions/1/diff']) {
    await request(app).get(path).expect(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    await request(app).get(path).set('Authorization', `Bearer ${login.body.data.token}`).expect(403);
  }
});
