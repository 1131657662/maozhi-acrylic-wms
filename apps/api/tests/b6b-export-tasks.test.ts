import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { exportFixture, exportInput, waitExport } from './export-fixture.ts';
import { matchedRequest } from './b6b-export-test-helpers.ts';
import { actor } from './fixture.ts';
import { AppError } from '../src/shared/errors.ts';

async function seedMatchedLineOverflow(db: Awaited<ReturnType<typeof exportFixture>>['db']): Promise<void> {
  for (let start = 0; start < 100_001; start += 500) {
    const rows = Array.from({ length: Math.min(500, 100_001 - start) }, (_, offset) => {
      const index = start + offset;
      const receipt = String(index % 240).padStart(6, '0');
      return [`B6B-LIMIT-${String(index).padStart(8, '0')}`, `WL-R${receipt}`, 'WL-P000130', 1, '0.0001', 0];
    });
    const values = rows.flat();
    const placeholders = rows.map(() => '(?,?,?,?,?,?)').join(',');
    await db.run(
      `INSERT INTO inbound_lines(id,receipt_id,product_code,packages,weight_tonnes,source_del_flag) VALUES ${placeholders}`,
      values,
    );
  }
}

test('B6b Step 4 同一请求重放复用任务且只允许运行一个导出', async () => {
  const f = await exportFixture(240);
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.service.hooks.afterBatch = async () => {
    reached();
    await gate;
  };
  try {
    const { input } = await exportInput(f, 'inbound');
    const firstPromise = f.service.create(input, actor);
    const replayPromise = f.service.create(input, actor);
    const [first, replay] = await Promise.all([firstPromise, replayPromise]);
    await started;
    assert.equal(replay.id, first.id);
    await assert.rejects(
      f.service.create({ ...input, requestId: randomUUID() }, actor),
      (error: unknown) => error instanceof AppError && error.code === 'EXPORT_BUSY',
    );
    release();
    assert.equal((await waitExport(f, first.id)).state, 'ready');
    console.log('B6B_STEP4_SINGLE_TASK sameRequestSameTask=true secondTask=409_EXPORT_BUSY');
  } finally {
    release();
    await f.dispose();
  }
});

test('B6b Step 4 超过 100000 行时 422 并返回实际行数', async () => {
  const f = await exportFixture(240);
  try {
    await seedMatchedLineOverflow(f.db);
    const query = {
      keyword: 'WL-RK-',
      productCodes: 'WL-P000130',
      productMode: 'any',
      from: '2026-11-01T00:00:00+08:00',
      to: '2026-11-30T23:59:59.999+08:00',
      page: '1',
      pageSize: '50',
      sortBy: 'receiptNo',
      direction: 'asc',
    };
    const page = await f.api.get('/api/v1/web/lists/inbound').query(query).set('Cookie', f.cookie).expect(200);
    assert.equal(page.body.data.matchedTotals.lineCount, 100_003);
    const request = matchedRequest(page.body.data, 'xlsx');
    const response = await f.api
      .post('/api/v1/web/exports')
      .set('Cookie', f.cookie)
      .set('Origin', 'http://localhost:5173')
      .send(request)
      .expect(422);
    assert.match(response.body.message, /实际 100,003 行/);
    assert.equal(await f.service.current(), null);
    const database = String((await f.db.get('SELECT DATABASE() AS name'))?.name);
    for (const extension of ['part', 'xlsx', 'csv'])
      await assert.rejects(access(path.resolve('.local/exports', database, request.requestId + '.' + extension)));
    console.log('B6B_STEP4_LIMIT status=422 actualLines=100003 taskCreated=false files=0');
  } finally {
    await f.dispose();
  }
});
