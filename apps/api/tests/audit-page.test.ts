import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shanghaiToday } from '@wms/contracts';
import { auditQueryFixture } from './audit-query-fixture.ts';
import { newReceipt, origin } from './numbering-fixture.ts';
const base = '/api/v1/web/lists/audit';

test('B6c-3 statistics use the current filter, distinct object identity, and exact Shanghai today', async () => {
  const c = await auditQueryFixture(3);
  try {
    const events = await c.db.all('SELECT id FROM operation_log WHERE trace_id=? ORDER BY id', [c.trace]);
    await c.db.run(
      "UPDATE operation_log SET action='catalog.publish',result='cancelled',target_kind='catalog' WHERE id=?",
      [String(events[0]!.id)],
    );
    await c.db.run("UPDATE operation_log SET result='unknown' WHERE id=?", [String(events[1]!.id)]);
    await c.db.run('UPDATE operation_log SET result=NULL,channel=NULL WHERE id=?', [String(events[2]!.id)]);
    const query = { target: 'RK-审计测试' };
    const read = await c.web.get(base).query(query).expect(200);
    assert.deepEqual(read.body.data.statistics, { records: 4, failures: 1, objects: 2, dangerous: 1, today: false });
    assert.deepEqual(
      new Set(read.body.data.items.map((r: { result: string }) => r.result)),
      new Set(['失败', '已取消', '结果待核实', '未记录']),
    );
    const failed = await c.web
      .get(base)
      .query({ ...query, result: 'failed' })
      .expect(200);
    assert.equal(failed.body.data.total, 1);
    assert.equal(failed.body.data.statistics.failures, 1);
    const dangerous = await c.web
      .get(base)
      .query({ ...query, dangerous: 'true' })
      .expect(200);
    assert.equal(dangerous.body.data.items[0].action, '发布条码目录');
    assert.equal(dangerous.body.data.statistics.dangerous, 1);
    const today = shanghaiToday();
    const dates = { from: `${today}T00:00:00+08:00`, to: `${today}T23:59:59.999+08:00` };
    assert.equal((await c.web.get(base).query({ ...query, ...dates })).body.data.statistics.today, true);
    assert.equal(
      (await c.web.get(base).query({ ...query, ...dates, to: `${today}T12:00:00+08:00` })).body.data.statistics.today,
      false,
    );
    const timeline = await c.web.get(`${base}/timeline`).query(query).expect(200);
    assert.deepEqual(timeline.body.data.statistics, read.body.data.statistics);
    for (const invalid of [{ unknown: 'value' }, { result: 'bogus' }, { channel: 'mobile' }, { dangerous: 'yes' }])
      await c.web.get(base).query(invalid).expect(422);
    console.log(
      'B6C3_STATS records=4 failures=1 objects=2 dangerous=1 filtered=consistent today=exact four_results=Chinese invalid=422',
    );
  } finally {
    await c.dispose();
  }
});

test('B6c-3 keyword matches document product codes and names without duplicate audit events', async () => {
  const c = await auditQueryFixture(1);
  try {
    const receipt = await c.web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send(newReceipt())
      .expect(200);
    const id = receipt.body.data.id;
    for (const keyword of ['ACR-032', '腈纶']) {
      const response = await c.web.get(base).query({ keyword }).expect(200);
      assert.ok(response.body.data.items.some((r: { href: string }) => r.href === `/inbound/${id}`));
      assert.equal(
        new Set(response.body.data.items.map((r: { id: string }) => r.id)).size,
        response.body.data.items.length,
      );
      assert.equal(response.body.data.statistics.records, response.body.data.total);
    }
    console.log('B6C3_KEYWORD product_code=matched product_name=matched duplicate_events=0');
  } finally {
    await c.dispose();
  }
});
