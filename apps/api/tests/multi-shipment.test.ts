import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { detailSchema } from '@wms/contracts';
import { shipmentFixture, shipmentBody, version } from './multi-shipment-fixture.ts';
import { inventorySnapshot } from './inventory-fixture.ts';

test('B5c-1 three shipments 40/30/20 short-close ten without posting; reverse all ninety exactly once', async () => {
  const c = await shipmentFixture();
  try {
    for (const packages of [40, 30, 20]) assert.equal((await c.ship(packages)).status, 'partially_shipped');
    const shipped = await c.records();
    assert.deepEqual(
      shipped.items.map((item) => [item.seq, item.lines[0]?.packages]),
      [
        [1, 40],
        [2, 30],
        [3, 20],
      ],
    );
    assert.equal(shipped.remainingPackages, 10);
    const stock = await c.db.get('SELECT packages,weight_tonnes FROM stock');
    assert.deepEqual(stock, { packages: 110, weight_tonnes: '33.0000' });
    const journals = await c.db.all('SELECT * FROM stock_journal ORDER BY id');
    const closed = await c
      .send(`${c.path}/short-close`, { ...version(await c.current()), reason: '客户取消余量' })
      .expect(200);
    assert.equal(closed.body.data.status, 'short_closed');
    assert.deepEqual(await c.db.get('SELECT packages,weight_tonnes FROM stock'), stock);
    assert.deepEqual(await c.db.all('SELECT * FROM stock_journal ORDER BY id'), journals);
    const result = await c.records();
    assert.equal(result.remainingPackages, 0);
    assert.equal(result.remainingWeightGrams, 0);
    assert.equal(result.shortClosure?.packages, 10);
    assert.equal(result.shortClosure?.weightGrams, 3000000);
    const preview = await c.web.get(`${'/api/v1'}${c.path}/lifecycle`).expect(200);
    assert.equal(preview.body.data.allowed, true, JSON.stringify(preview.body.data.blockers));
    const key = randomUUID(),
      input = { expectedToken: preview.body.data.token, reason: '撤销全部三次发货' };
    await c.send(`${c.path}/reverse`, input, key).expect(200);
    await c.send(`${c.path}/reverse`, input, key).expect(200);
    assert.deepEqual(await c.db.get('SELECT packages,weight_tonnes FROM stock'), {
      packages: 200,
      weight_tonnes: '60.0000',
    });
    assert.deepEqual((await c.records()).items, shipped.items);
    assert.equal(Number((await c.db.get('SELECT SUM(packages_delta) AS n FROM stock_journal'))?.n), 0);
    console.log(
      'B5C1_FLOW shipments=3 actual=90/27000000g stock=110/33000000g short_closed=10/3000000g short_close_journal_delta=0 reverse_stock=200/60000000g replay_compensations=1',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-1 complete identifies remaining lines, then completes only when both units are fulfilled', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(40);
    const error = await c.send(`${c.path}/complete`, version(await c.current())).expect(422);
    assert.equal(error.body.data.lines[0].lineId, c.order.lines[0]!.id);
    assert.equal(error.body.data.lines[0].packages, 60);
    await c.ship(60);
    const before = await c.db.all('SELECT * FROM stock_journal ORDER BY id');
    const done = await c.send(`${c.path}/complete`, version(await c.current())).expect(200);
    assert.equal(done.body.data.status, 'confirmed');
    assert.ok((await c.records()).completedAt);
    assert.deepEqual(await c.db.all('SELECT * FROM stock_journal ORDER BY id'), before);
    console.log(
      'B5C1_COMPLETE remaining=60 rejected=422 remaining=0 status=confirmed completed_at=recorded inventory_delta=0',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-1 plan edit recomputes remaining and retains immutable shipments and scan snapshots', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(40);
    const original = (await c.records()).items;
    const scans = await c.db.all('SELECT id,scan_packages,scan_weight_grams FROM outbound_lines ORDER BY id');
    const line = c.order.lines[0]!;
    await c
      .send(
        `${c.path}/plan`,
        {
          ...version(await c.current()),
          plan: {
            containerNo: '新柜号',
            lines: [
              { id: line.id, plannedPackages: 50, plannedWeightGrams: 15000000, contractNo: '新合同', memo: '改待发' },
            ],
          },
        },
        randomUUID(),
        'patch',
      )
      .expect(200);
    assert.equal((await c.records()).remainingPackages, 10);
    assert.deepEqual((await c.records()).items, original);
    await c.ship(10);
    assert.deepEqual(
      await c.db.all('SELECT id,scan_packages,scan_weight_grams FROM outbound_lines ORDER BY id'),
      scans,
    );
    assert.equal((await c.current()).actualPackages, 50);
    assert.equal((await c.records()).remainingPackages, 0);
    console.log('B5C1_PLAN plan=100->50 shipped=40 unchanged remaining=60->10 shipment_snapshots_unchanged=true');
  } finally {
    await c.dispose();
  }
});

test('B5c-1 overage requires per-line reason in either unit and stock shortage rolls back everything', async () => {
  const c = await shipmentFixture();
  try {
    const body = shipmentBody(await c.current(), 101);
    const rejected = await c.send(`${c.path}/shipments`, body).expect(422);
    assert.deepEqual(rejected.body.data.fields[0].path, ['lines', 0, 'overageReason']);
    await c
      .send(`${c.path}/shipments`, {
        ...body,
        lines: body.lines.map((line) => ({ ...line, overageReason: '客户追加' })),
      })
      .expect(200);
    assert.equal((await c.current()).actualPackages, 101);
    const created = await c
      .send('/outbound', {
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: '库存不足验收',
        lines: [{ productCode: 'ACR-032', plannedPackages: 100, plannedWeightGrams: 30000000 }],
      })
      .expect(200);
    const second = detailSchema.parse(created.body.data);
    const before = await inventorySnapshot(c.db);
    const tooMuch = shipmentBody(second, 101);
    const failed = await c
      .send(`/outbound/${second.id}/shipments`, {
        ...tooMuch,
        lines: tooMuch.lines.map((line) => ({ ...line, overageReason: '追加' })),
      })
      .expect(409);
    assert.equal(failed.body.code, 'INSUFFICIENT_STOCK');
    assert.deepEqual(await inventorySnapshot(c.db), before);
    console.log('B5C1_OVERAGE without_reason=422 with_reason=200 stock_shortage=409 rollback=true');
  } finally {
    await c.dispose();
  }
});
