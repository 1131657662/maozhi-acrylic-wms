import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { catalogUploadErrorsSchema, CATALOG_ERROR_MAX_ROWS } from '@wms/contracts';
import { catalogFixture, catalogSnapshot } from './catalog-fixture.ts';
import { uploadErrorCsv } from '../../web/src/features/catalog/upload-error-csv.ts';

async function reportFixture() {
  const fixture = await catalogFixture();
  const web = request.agent(fixture.app);
  await web
    .post('/api/v1/auth/login')
    .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
    .expect(200);
  const send = (text: string) =>
    web
      .post('/api/v1/catalog/uploads')
      .query({ encoding: 'utf-8', fileName: 'sku.txt' })
      .set('Origin', 'http://localhost:5173')
      .set('Idempotency-Key', randomUUID())
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from(text));
  return { ...fixture, send };
}

test('上传422返回全部三条错误，CSV保留对应行号、原文与原因', async (t) => {
  const f = await reportFixture();
  t.after(f.dispose);
  const before = await catalogSnapshot(f.db);
  const response = await f.send('规格 A nope\n规格 B 0\n坏行').expect(422);
  const report = catalogUploadErrorsSchema.parse(response.body.data);
  assert.deepEqual(report, {
    errors: [
      { line: 1, raw: '规格 A nope', reason: '重量必须为正十进制 千克' },
      { line: 2, raw: '规格 B 0', reason: '重量为零、负数或超出支持范围' },
      { line: 3, raw: '坏行', reason: '缺少规格、条码或重量' },
    ],
    truncated: false,
  });
  assert.equal(
    uploadErrorCsv(report),
    '\uFEFF"行号","原始行内容","原因"\r\n' +
      '"1","规格 A nope","重量必须为正十进制 千克"\r\n' +
      '"2","规格 B 0","重量为零、负数或超出支持范围"\r\n' +
      '"3","坏行","缺少规格、条码或重量"\r\n',
  );
  assert.deepEqual(await catalogSnapshot(f.db), before);
  const attempts = await f.db.all("SELECT * FROM operation_attempts WHERE action='catalog.upload'");
  assert.equal(attempts.length, 1);
  assert.deepEqual(attempts[0]?.input_summary, {});
  assert.equal(attempts[0]?.failure_reason, '填写内容不符合要求，请检查后重试');
  assert.equal(JSON.stringify(attempts).includes('规格 A nope'), false);
});

test('上传错误500条保留全部，501条只返回前500条并提示', async (t) => {
  const f = await reportFixture();
  t.after(f.dispose);
  const before = await catalogSnapshot(f.db);
  for (const count of [CATALOG_ERROR_MAX_ROWS, CATALOG_ERROR_MAX_ROWS + 1]) {
    const text = Array.from({ length: count }, (_, i) => `规格 ROW-${i} 0`).join('\n');
    const response = await f.send(text).expect(422);
    const report = catalogUploadErrorsSchema.parse(response.body.data);
    assert.equal(report.errors.length, CATALOG_ERROR_MAX_ROWS);
    assert.equal(report.truncated, count > CATALOG_ERROR_MAX_ROWS);
    assert.equal(report.errors.at(-1)?.line, CATALOG_ERROR_MAX_ROWS);
    if (report.truncated) assert.equal(response.body.message, '错误过多，仅显示前 500 条');
  }
  assert.deepEqual(await catalogSnapshot(f.db), before);
});

test('错误CSV转义引号、逗号、换行和公式前缀，不改响应数据', () => {
  const errors = ['=1+1', ' +123', '-123', '@sum(A1)', '\t危险', '含,"引号"\n换行'].map((raw, index) => ({
    line: index + 1,
    raw,
    reason: '错误',
  }));
  const before = structuredClone(errors);
  const csv = uploadErrorCsv({ errors, truncated: false });
  for (const raw of errors.slice(0, 5)) assert.ok(csv.includes(`"'${raw.raw}"`));
  assert.ok(csv.includes('"含,""引号""\n换行"'));
  assert.deepEqual(errors, before);
});
