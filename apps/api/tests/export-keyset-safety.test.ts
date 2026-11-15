import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { exportFixture, exportInput, waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

for (const kind of ['stock', 'audit', 'inbound', 'outbound'] as const)
  test(`B6i-1 ${kind}: cancel between keyset batches removes every partial artifact`, async () => {
    const f = await exportFixture(2400);
    try {
      for (const format of ['xlsx', 'csv'] as const) {
        const { input } = await exportInput(f, kind);
        input.format = format;
        f.service.hooks.afterBatch = async () => {
          await f.service.cancel(input.requestId);
        };
        const job = await f.service.create(input, actor);
        const end = await waitExport(f, job.id);
        assert.equal(end.state, 'cancelled');
        assert.ok(end.processed > 0 && end.processed < end.total);
        await assert.rejects(f.service.download(job.id), { status: 409 });
        const name = String((await f.db.get('SELECT DATABASE() AS name'))?.name);
        for (const extension of ['part', 'xlsx', 'csv'])
          await assert.rejects(access(path.resolve('.local/exports', name, `${job.id}.${extension}`)));
      }
    } finally {
      await f.dispose();
    }
  });

test('B6i-1 snapshot allows concurrent list reads and writes without table locks', async () => {
  const f = await exportFixture(1200);
  try {
    const { input } = await exportInput(f, 'stock');
    let checked = false;
    f.service.hooks.afterBatch = async () => {
      if (checked) return;
      checked = true;
      await f.db.withConnection(async (db) => {
        await db.run('SET SESSION innodb_lock_wait_timeout=1');
        await db.run("UPDATE stock SET packages=99,weight_tonnes=29.7000 WHERE product_code='WL-P001199'");
      });
      const list = await f.api
        .get('/api/v1/web/lists/stock')
        .set('Cookie', f.cookie)
        .query({ ...input.query, product: 'WL-P001199', page: '1' })
        .expect(200);
      assert.equal(list.body.data.items[0].packages, 99);
      assert.equal(list.body.data.total, 1);
    };
    const job = await f.service.create(input, actor);
    assert.equal((await waitExport(f, job.id)).state, 'ready');
    assert.equal(checked, true);
    const { sheet } = await workbook(f, job.id);
    assert.equal(sheet.getCell(1201, 2).value, 'WL-P001199');
    assert.equal(sheet.getCell(1201, 3).value, 2);
    assert.equal(sheet.getCell(1201, 4).value, 0.6);
  } finally {
    await f.dispose();
  }
});
