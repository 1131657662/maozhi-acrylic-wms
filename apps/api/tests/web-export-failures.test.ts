import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { exportFixture, exportInput, waitExport, workbook, evidence } from './export-fixture.ts';
import { actor } from './fixture.ts';
import { AppError } from '../src/shared/errors.ts';

test('B1b2 snapshot survives concurrent updates; second task reports busy; retry reuses artifact', async () => {
  const f = await exportFixture(1200);
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    reached = r;
  });
  f.service.hooks.afterBatch = async (n) => {
    if (n === 1000) {
      reached();
      await gate;
    }
  };
  try {
    const { input } = await exportInput(f, 'stock');
    const job = await f.service.create(input, actor);
    await started;
    const response = await f.api
      .post('/api/v1/web/exports')
      .set('Cookie', f.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({ ...input, requestId: randomUUID() })
      .expect(409);
    assert.equal(response.body.code, 'EXPORT_BUSY');
    assert.equal((await f.service.create(input, actor)).id, job.id);
    await f.db.run("UPDATE stock SET packages=99,weight_tonnes=29.7000 WHERE product_code='WL-P001199'");
    release();
    const end = await waitExport(f, job.id);
    assert.equal(end.state, 'ready', end.error ?? '');
    const { sheet } = await workbook(f, job.id);
    assert.equal(sheet.getCell(1201, 2).value, 'WL-P001199');
    assert.equal(sheet.getCell(1201, 3).value, 2);
    assert.equal(sheet.getCell(1201, 4).value, 0.6);
    assert.equal(end.totals.packages, '2400');
    assert.equal((await f.service.create(input, actor)).sha256, end.sha256);
    await evidence('B1B2_CONCURRENT', {
      busyStatus: response.status,
      busyMessage: response.body.message,
      snapshotLastPackages: sheet.getCell(1201, 3).value,
      databaseLastPackages: 99,
      rows: 1200,
      retrySameSha: true,
    });
  } finally {
    release();
    await f.dispose();
  }
});
for (const failure of ['write', 'cancel'] as const)
  test(`B1b2 ${failure}: no downloadable partial file`, async () => {
    const f = await exportFixture(1200);
    let id = '';
    f.service.hooks.afterBatch = async () => {
      if (failure === 'write') throw new Error('TEST_DISK_WRITE_FAILURE');
      await f.service.cancel(id);
    };
    try {
      const { input } = await exportInput(f, 'outbound');
      id = input.requestId;
      await f.service.create(input, actor);
      const job = await waitExport(f, id);
      assert.equal(job.state, failure === 'write' ? 'failed' : 'cancelled');
      await assert.rejects(
        f.service.download(id),
        (e: unknown) => e instanceof AppError && e.code === 'EXPORT_NOT_READY',
      );
      const res = await f.api.get(`/api/v1/web/exports/${id}/download`).set('Cookie', f.cookie).expect(409);
      await evidence('B1B2_FAILURE', {
        failure,
        state: job.state,
        processed: job.processed,
        total: job.total,
        downloadStatus: res.status,
        bytes: job.bytes,
      });
      f.service.hooks.afterBatch = undefined;
      const next = await exportInput(f, 'outbound', 'page');
      await f.service.create(next.input, actor);
      assert.equal((await waitExport(f, next.input.requestId)).state, 'ready');
    } finally {
      await f.dispose();
    }
  });
