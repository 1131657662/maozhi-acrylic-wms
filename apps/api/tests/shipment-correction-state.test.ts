import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipmentFixture, version } from './multi-shipment-fixture.ts';
import { shipmentCorrectionFixture, correctionInput } from './shipment-correction-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B5c-2 confirmed correction reopens pending; replenishment closes with original completion evidence retained', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    const completed = (await c.records()).completedAt;
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 40)).expect(200);
    assert.equal((await c.current()).status, 'partially_shipped');
    assert.equal((await c.records()).remainingPackages, 20);
    assert.equal((await c.records()).completedAt, completed);
    const audit = await c.db.get(
      "SELECT before_json,after_json,projection_json FROM operation_log WHERE action='outbound.correction'",
    );
    const before = JSON.parse(String(audit!.before_json)),
      after = JSON.parse(String(audit!.after_json));
    assert.equal(before.status, 'confirmed');
    assert.equal(after.status, 'partially_shipped');
    assert.equal(after.reason, '更正');
    assert.match(JSON.stringify(audit!.projection_json), /已出库/);
    assert.equal((await c.ship(20)).status, 'confirmed');
    assert.equal((await c.records()).remainingPackages, 0);
    const preview = (await c.web.get(`/api/v1${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, true);
    await c.send(`${c.path}/reverse`, { reason: '交错流水全部撤销', expectedToken: preview.token }).expect(200);
    assert.equal((await c.db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))!.packages, 200);
    console.log(
      'B5C2_STATE confirmed=100 correction=-20 partial_pending=20 replenished=20 confirmed=true interleaved_reverse_stock=200',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-2 short-closed corrections update remaining evidence without reopening or altering close time', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(90);
    await c.send(`${c.path}/short-close`, { ...version(await c.current()), reason: '剩余不发' }).expect(200);
    const closed = (await c.records()).shortClosure!;
    await c.send(`${c.path}/corrections`, await correctionInput(c, 1, 80)).expect(200);
    const after = await c.current(),
      records = await c.records();
    assert.equal(after.status, 'short_closed');
    assert.deepEqual(records.shortClosure, { ...closed, packages: 20, weightGrams: 6000000 });
    assert.equal(records.remainingPackages, 0);
    await c
      .send(`${c.path}/shipments`, {
        ...version(after),
        lines: [{ lineId: after.lines[0]!.id, actualPackages: 1, actualWeightGrams: 300000 }],
      })
      .expect(409);
    const audit = await c.db.get(
      "SELECT after_json,projection_json FROM operation_log WHERE action='outbound.correction'",
    );
    assert.equal(JSON.parse(String(audit!.after_json)).shortClosedPackages, 20);
    assert.match(JSON.stringify(audit!.projection_json), /短关剩余包数/);
    console.log(
      'B5C2_SHORT_CLOSE correction=-10 status=short_closed remaining=10->20 time_unchanged=true cannot_ship=409',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-2 confirmed positive correction with insufficient inventory rolls back quantity and status', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    await c.db.run("UPDATE stock SET packages=5,weight_tonnes='1.5000' WHERE product_code='ACR-032'");
    const before = await businessFingerprint(c.db);
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 70)).expect(409);
    assert.deepEqual(await businessFingerprint(c.db), before);
    assert.equal((await c.current()).status, 'confirmed');
    console.log('B5C2_SHORTAGE correction=+10 stock=5 status=409 business_unchanged=true');
  } finally {
    await c.dispose();
  }
});

test('B5c-2 duplicated order line gives actionable 422; separate correction chain accumulates both shipments', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    const first = await correctionInput(c, 1, 30),
      second = await correctionInput(c, 2, 50);
    const before = await businessFingerprint(c.db);
    const invalid = await c
      .send(`${c.path}/corrections`, { ...first, lines: [...first.lines, ...second.lines] })
      .expect(422);
    assert.equal(invalid.body.code, 'CORRECTION_ORDER_LINE_DUPLICATE');
    assert.match(invalid.body.message, /请为另一批发货另开更正单/);
    assert.deepEqual(await businessFingerprint(c.db), before);
    await c.send(`${c.path}/corrections`, first).expect(200);
    const response = await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 50)).expect(200);
    assert.equal(response.body.data.lines[0].shipment.seq, 2);
    assert.ok(response.body.data.lines[0].shipment.shippedAt);
    assert.equal(response.body.data.lines[0].shipment.vehicleNo, '分批验收');
    assert.equal((await c.current()).corrections!.effective.packages, 80);
    assert.equal((await c.records()).remainingPackages, 20);
    console.log('B5C2_GRANULARITY same_request=422 separate_requests=200/200 effective=30/50 remaining=20');
  } finally {
    await c.dispose();
  }
});
