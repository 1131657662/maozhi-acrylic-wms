import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctionSchema, correctionSummarySchema } from '@wms/contracts';
import { correctionFixture } from './correction-fixture.ts';
import { origin } from './numbering-fixture.ts';

for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind} 包数独立更正与详情三处`, async () => {
    const c = await correctionFixture(kind);
    try {
      const original = (await c.detail()).body.data;
      const before = await c.db.get("SELECT * FROM stock WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'");
      const correction = correctionSchema.parse((await c.post(await c.input()).expect(200)).body.data);
      const result = (await c.detail()).body.data,
        summary = correctionSummarySchema.parse(result.corrections);
      const after = await c.db.get("SELECT * FROM stock WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'");
      const journal = await c.db.get('SELECT * FROM stock_journal WHERE correction_id=?', [correction.id]);
      assert.equal(Number(after?.packages) - Number(before?.packages), kind === 'inbound' ? 1 : -1);
      assert.equal(after?.weight_tonnes, before?.weight_tonnes);
      assert.equal(journal?.packages_before, before?.packages);
      assert.equal(journal?.packages_after, after?.packages);
      assert.equal(summary.effective.packages, summary.original.packages + 1);
      assert.deepEqual(summary.delta, { packages: 1, weightGrams: 0 });
      assert.equal(summary.latest?.number, correction.number);
      assert.deepEqual(result.lines, original.lines);
      assert.equal(result.businessDate, original.businessDate);
      assert.equal((await c.web.get(`${c.path}/corrections`).expect(200)).body.data.length, 1);
      assert.equal((await c.web.get(`/api/v1/corrections/${correction.id}`).expect(200)).body.data.id, correction.id);
      console.log(
        'B5A_SUCCESS',
        JSON.stringify({
          kind,
          before,
          after,
          journal,
          effective: summary.effective,
          cumulativeDelta: summary.delta,
          latest: summary.latest,
          originalUnchanged: true,
        }),
      );
    } finally {
      await c.dispose();
    }
  });

test('B5a 入库→连续更正包数→撤销，库存净零且链已抵消', async () => {
  const c = await correctionFixture();
  try {
    const original = (await c.detail()).body.data;
    await c.post(await c.input()).expect(200);
    await c.post(await c.input()).expect(200);
    const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, true);
    await c.web
      .post(`${c.path}/reverse`)
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({ reason: 'B5a 合成撤销', expectedToken: preview.token })
      .expect(200);
    const detail = (await c.detail()).body.data,
      summary = correctionSummarySchema.parse(detail.corrections);
    const rows = await c.db.all(
      'SELECT operation_id,correction_id,packages_delta,tonnes_delta,packages_before,packages_after FROM stock_journal ORDER BY id',
    );
    assert.equal(
      rows.reduce((sum, row) => sum + Number(row.packages_delta), 0),
      0,
    );
    assert.equal(
      rows.reduce((sum, row) => sum + Number(row.tonnes_delta), 0),
      0,
    );
    assert.deepEqual(detail.lines, original.lines);
    assert.equal(summary.offset, true);
    assert.equal(summary.allowed, false);
    assert.equal(new Set(summary.records.map((r) => r.offsetOperationId)).size, 1);
    await c.post(await c.input()).expect(409);
    const stock = await c.db.get("SELECT packages,weight_tonnes FROM stock WHERE product_code='ACR-032'");
    assert.deepEqual(stock, { packages: 6, weight_tonnes: '1.8000' });
    const sql = readFileSync('scripts/sql/verify-document-lifecycle.sql', 'utf8');
    for (const statement of sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .filter((part) => part.trim())) {
      const evidence = await c.db.all(statement);
      assert.ok(
        evidence.every((row) => ('balanced' in row ? Number(row.balanced) === 1 : Number(row.mismatches) === 0)),
      );
      console.log('B5A_REVERSE_SQL', JSON.stringify(evidence));
    }
    console.log(
      'B5A_REVERSE',
      JSON.stringify({
        stock,
        journal: rows,
        packagesNet: 0,
        tonnesNet: 0,
        originalUnchanged: true,
        offsetOperationId: summary.records[0]?.offsetOperationId,
        reopenStatus: 409,
      }),
    );
  } finally {
    await c.dispose();
  }
});

test('B5a 同键重放只生效一次，同版本不同键并发互斥', async () => {
  const c = await correctionFixture();
  try {
    const input = await c.input(),
      key = randomUUID();
    const first = await c.post(input, key).expect(200),
      replay = await c.post(input, key).expect(200);
    assert.deepEqual(replay.body.data, first.body.data);
    await c.post({ ...input, reason: '不同正文' }, key).expect(409);
    const next = await c.input();
    const results = await Promise.all([c.post(next), c.post(next)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const counts = await c.db.get(`SELECT (SELECT COUNT(*) FROM document_corrections) AS corrections,
      (SELECT COUNT(*) FROM inventory_operations WHERE operation_type='stock.correct') AS operations,
      (SELECT COUNT(*) FROM operation_log WHERE action='stock.correct') AS audits,
      (SELECT COUNT(*) FROM idempotent_commands WHERE command_key LIKE 'correction.create:%') AS commands`);
    assert.deepEqual(Object.fromEntries(Object.entries(counts!).map(([key, value]) => [key, Number(value)])), {
      corrections: 2,
      operations: 2,
      audits: 2,
      commands: 2,
    });
    console.log(
      'B5A_IDEMPOTENCY_CONCURRENCY',
      JSON.stringify({
        replaySameId: replay.body.data.id === first.body.data.id,
        concurrentStatuses: results.map((r) => r.status),
        counts,
      }),
    );
  } finally {
    await c.dispose();
  }
});
