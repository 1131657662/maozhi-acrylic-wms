import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { exportFixture, exportInput, waitExport, workbook, evidence } from './export-fixture.ts';
import { actor } from './fixture.ts';
import { WebExports } from '../src/features/web-exports/service.ts';
import { AppError } from '../src/shared/errors.ts';

test('B1b2 completed file survives restart; interrupted task fails closed; corrupt file rejects', async () => {
  const f = await exportFixture();
  try {
    const { input } = await exportInput(f, 'inbound', 'page');
    await f.service.create(input, actor);
    const job = await waitExport(f, input.requestId);
    const file = await f.service.download(job.id);
    const root = path.dirname(file.path);
    const interruptedId = randomUUID();
    await writeFile(
      path.join(root, interruptedId + '.json'),
      JSON.stringify({ ...job, id: interruptedId, state: 'running' }),
    );
    await writeFile(path.join(root, interruptedId + '.part'), 'incomplete');
    const restored = new WebExports(f.db, root);
    assert.equal((await restored.get(job.id)).sha256, job.sha256);
    assert.equal((await restored.get(interruptedId)).errorCode, 'EXPORT_INTERRUPTED');
    await assert.rejects(readFile(path.join(root, interruptedId + '.part')));
    await assert.rejects(restored.download(interruptedId));
    const http = await f.api.get(`/api/v1/web/exports/${job.id}/download`).set('Cookie', f.cookie).expect(200);
    assert.match(String(http.headers['content-type']), /spreadsheetml/);
    assert.equal(Number(http.headers['content-length']), job.bytes);
    assert.equal((await readFile(file.path)).subarray(0, 2).toString(), 'PK');
    await writeFile(file.path, 'corrupt');
    await assert.rejects(
      restored.download(job.id),
      (e: unknown) => e instanceof AppError && e.code === 'EXPORT_FILE_MISSING',
    );
    await evidence('B1B2_RECOVERY', {
      readySurvivesRestart: true,
      interrupted: 'EXPORT_INTERRUPTED',
      partialRemoved: true,
      corruptRejected: true,
      downloadStatus: http.status,
    });
  } finally {
    await f.dispose();
  }
});

test('B1b2 whitelist/source/idempotency guards and empty range reject explicitly', async () => {
  const f = await exportFixture();
  try {
    const { input } = await exportInput(f, 'stock');
    const post = (body: object) =>
      f.api.post('/api/v1/web/exports').set('Cookie', f.cookie).set('Origin', 'http://localhost:5173').send(body);
    await post({ ...input, columns: ['productName', 'secret'] }).expect(422);
    await post({ ...input, query: { ...input.query, source: 'all' } }).expect(422);
    await f.service.create(input, actor);
    await waitExport(f, input.requestId);
    await post({ ...input, scope: 'page' }).expect(409);
    const query = { ...input.query, product: 'NO-SUCH-EXPORT-FIXTURE' };
    const empty = await f.api.get('/api/v1/web/lists/stock').query(query).set('Cookie', f.cookie).expect(200);
    const next = { ...input, requestId: randomUUID(), query, viewToken: empty.body.data.viewToken };
    await f.service.create(next, actor);
    assert.equal((await waitExport(f, next.requestId)).errorCode, 'EXPORT_EMPTY');
    await evidence('B1B2_GUARDS', { illegalColumn: 422, crossSource: 422, changedRetry: 409, empty: 'EXPORT_EMPTY' });
  } finally {
    await f.dispose();
  }
});

test('B1b2 text remains text: formula prefixes, leading zero, Unicode and line break', async () => {
  const f = await exportFixture();
  const literal = '=HYPERLINK("https://invalid.example","腈纶")\n第二行';
  try {
    await f.db.run('UPDATE outbound_orders SET customer_name=?,vehicle_no=? WHERE id=?', [
      literal,
      '000123',
      'WL-O000020',
    ]);
    const { input } = await exportInput(f, 'outbound', 'page');
    input.columns = ['orderNo', 'customerName', 'vehicleNo'];
    await f.service.create(input, actor);
    assert.equal((await waitExport(f, input.requestId)).state, 'ready');
    const { sheet } = await workbook(f, input.requestId);
    assert.equal(sheet.getCell('B2').value, literal);
    assert.equal(sheet.getCell('B2').formula, undefined);
    assert.equal(sheet.getCell('C2').value, '000123');
    await evidence('B1B2_TEXT', { formulaCount: 0, leadingZeroPreserved: true, unicodeAndNewlinePreserved: true });
  } finally {
    await f.dispose();
  }
});
