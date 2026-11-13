import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { WEB_EXPORT_MAX_ROWS } from '@wms/contracts';
import { catalogFixture } from './catalog-fixture.ts';
import type { Database } from '../src/db/mysql.ts';
import { insertEntries } from '../src/features/catalog/repository.ts';

// Deliberately oversized historical snapshot in a disposable database only.
async function oversizedFixture(db: Database) {
  assert.match(String((await db.get('SELECT DATABASE() AS n'))?.n), /^maozhi_test_[a-f0-9]+$/);
  for (let offset = 0; offset <= WEB_EXPORT_MAX_ROWS; offset += 1000) {
    const batch = Array.from({ length: Math.min(1000, WEB_EXPORT_MAX_ROWS + 1 - offset) }, (_, i) => ({
      barcode: `BOUND-${String(offset + i).padStart(6, '0')}`,
      sourceSpec: offset + i < WEB_EXPORT_MAX_ROWS ? 'BOUNDARY-MATCH' : 'BOUNDARY-EXTRA',
      rawWeightKg: '300.0',
      weightGrams: 300000,
      legacyProductCode: null,
    }));
    await insertEntries(db, 1, batch);
  }
}
function readBuffer(response: request.Response, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}
async function verifyRows(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  const sheet = workbook.getWorksheet('导出记录')!;
  for (let index = 0; index < WEB_EXPORT_MAX_ROWS; index++) {
    const row = sheet.getRow(index + 2);
    assert.equal(row.getCell(1).value, `BOUND-${String(index).padStart(6, '0')}`);
    assert.equal(row.getCell(3).value, 300);
    assert.equal(row.getCell(3).numFmt, '0.000');
    assert.equal(row.getCell(4).value, '第 1 版');
  }
  assert.equal(sheet.rowCount, WEB_EXPORT_MAX_ROWS + 2);
}

test('真实XLSX接口完整流式导出100000行，100001行在发文件前返回422', async (t) => {
  const f = await catalogFixture();
  t.after(f.dispose);
  await oversizedFixture(f.db);
  const web = request.agent(f.app);
  await web.post('/api/v1/auth/login').send({ username: 'owner', password: 'test-only-password', channel: 'web' });
  const before = await f.db.all(
    'CHECKSUM TABLE catalog_entries, catalog_versions, catalog_head, stock, stock_journal, operation_log, operation_attempts, idempotent_commands',
  );
  const screen = await web.get('/api/v1/catalog/search').query({ q: 'BOUNDARY-MATCH' }).expect(200);
  assert.equal(screen.body.data.total, WEB_EXPORT_MAX_ROWS);
  const start = performance.now();
  const response = await web
    .get('/api/v1/catalog/export')
    .query({ q: 'BOUNDARY-MATCH', versionId: 1 })
    .buffer(true)
    .parse(readBuffer)
    .expect(200);
  await verifyRows(response.body);
  assert.deepEqual(
    await f.db.all(
      'CHECKSUM TABLE catalog_entries, catalog_versions, catalog_head, stock, stock_journal, operation_log, operation_attempts, idempotent_commands',
    ),
    before,
  );
  const rejected = await web.get('/api/v1/catalog/export').query({ q: 'BOUND-', versionId: 1 }).expect(422);
  assert.equal(rejected.body.code, 'EXPORT_TOO_LARGE');
  assert.match(rejected.body.message, /缩小搜索或筛选条件/);
  assert.match(rejected.headers['content-type'] ?? '', /application\/json/);
  assert.equal(rejected.headers['content-disposition'], undefined);
  const after = await f.db.all(
    'CHECKSUM TABLE catalog_entries, catalog_versions, catalog_head, stock, stock_journal, operation_log, idempotent_commands',
  );
  assert.deepEqual(
    after,
    before.filter((row) => !String(row.Table).endsWith('.operation_attempts')),
  );
  const attempts = await f.db.all('SELECT input_summary,error_code FROM operation_attempts');
  assert.deepEqual(attempts, [{ input_summary: {}, error_code: 'EXPORT_TOO_LARGE' }]);
  t.diagnostic(
    `100000 data rows checked in order; XLSX bytes=${response.body.length}; export/readback=${Math.round(performance.now() - start)}ms`,
  );
});
