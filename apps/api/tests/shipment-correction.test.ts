import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shipmentCorrectionFixture, correctionInput } from './shipment-correction-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B5c-2 multiple shipments require attribution; correction of second line changes only it and pending', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    const input = await correctionInput(c, 2, 50),
      before = await businessFingerprint(c.db);
    const { shipmentLineId, ...withoutId } = input.lines[0]!;
    const invalid = await c.send(`${c.path}/corrections`, { ...input, lines: [withoutId] }).expect(422);
    assert.equal(invalid.body.code, 'SHIPMENT_LINE_REQUIRED');
    assert.equal(invalid.body.data.lines.length, 2);
    assert.deepEqual(await businessFingerprint(c.db), before);
    const snapshots = await c.db.all('SELECT * FROM outbound_shipment_lines ORDER BY id');
    const result = await c.send(`${c.path}/corrections`, input).expect(200);
    assert.equal(result.body.data.lines[0].shipmentLineId, shipmentLineId);
    const records = await c.records(),
      order = await c.current();
    assert.deepEqual(
      records.items.map((sh) => sh.lines[0]!.effectivePackages),
      [40, 50],
    );
    assert.deepEqual(
      records.items.map((sh) => sh.lines[0]!.packages),
      [40, 60],
    );
    assert.equal(records.remainingPackages, 10);
    assert.equal(records.remainingWeightGrams, 3000000);
    assert.equal(order.corrections!.effective.packages, 90);
    assert.deepEqual(await c.db.all('SELECT * FROM outbound_shipment_lines ORDER BY id'), snapshots);
    console.log(
      'B5C2_TARGET missing_id=422 original=40/60 effective=40/50 remaining=10/3000000g snapshots_unchanged=true',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-2 foreign order or wrong order line shipment reference is rejected without stock change', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    const created = await c
      .send('/outbound', {
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: '外单',
        lines: Array.from({ length: 2 }, () => ({
          productCode: 'ACR-032',
          plannedPackages: 1,
          plannedWeightGrams: 300000,
        })),
      })
      .expect(200);
    const other = created.body.data;
    await c
      .send(`/outbound/${other.id}/shipments`, {
        revision: other.revision,
        digest: other.digest,
        lines: other.lines.map((line: { id: string }) => ({
          lineId: line.id,
          actualPackages: 1,
          actualWeightGrams: 300000,
        })),
      })
      .expect(200);
    const reference = (await c.web.get(`/api/v1/outbound/${other.id}/shipments`).expect(200)).body.data.items[0]
      .lines[1].shipmentLineId;
    const input = await correctionInput(c, 2, 50),
      before = await businessFingerprint(c.db);
    await c
      .send(`${c.path}/corrections`, { ...input, lines: [{ ...input.lines[0], shipmentLineId: reference }] })
      .expect(422);
    await c
      .send(`${c.path}/corrections`, { ...input, lines: [{ ...input.lines[0], originalLineId: other.lines[0].id }] })
      .expect(422);
    const wrongLine = await c
      .send(`/outbound/${other.id}/corrections`, {
        ...input,
        lines: [{ ...input.lines[0], originalLineId: other.lines[0].id, shipmentLineId: reference }],
      })
      .expect(422);
    assert.equal(wrongLine.body.code, 'SHIPMENT_LINE_INVALID');
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log('B5C2_TARGET foreign_order=422 same_order_wrong_line=422 invalid_order_line=422 stock_unchanged=true');
  } finally {
    await c.dispose();
  }
});

test('B5c-2 concurrent correction replay posts one result and invalidates an old shipment version', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    const old = await c.current(),
      input = await correctionInput(c, 2, 50),
      key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => c.send(`${c.path}/corrections`, input, key).expect(200)),
    );
    assert.equal(new Set(results.map((r) => r.body.data.id)).size, 1);
    assert.equal(
      Number(
        (await c.db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='stock.correct'"))!.n,
      ),
      1,
    );
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='stock.correct'"))!.n),
      1,
    );
    await c
      .send(`${c.path}/shipments`, {
        revision: old.revision,
        digest: old.digest,
        lines: [{ lineId: old.lines[0]!.id, actualPackages: 10, actualWeightGrams: 3000000 }],
      })
      .expect(409);
    assert.equal((await c.db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))!.packages, 110);
    console.log('B5C2_CONCURRENCY requests=10 corrections=1 success_events=1 stale_shipment=409 stock=110');
  } finally {
    await c.dispose();
  }
});

test('B5c-2 whole reversal compensates all shipments and correction once', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 50)).expect(200);
    const preview = (await c.web.get(`/api/v1${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, true);
    const body = { reason: '整单撤销更正链', expectedToken: preview.token },
      key = randomUUID();
    await c.send(`${c.path}/reverse`, body, key).expect(200);
    await c.send(`${c.path}/reverse`, body, key).expect(200);
    assert.deepEqual(await c.db.get("SELECT packages,weight_tonnes FROM stock WHERE product_code='ACR-032'"), {
      packages: 200,
      weight_tonnes: '60.0000',
    });
    const order = await c.current();
    assert.equal(order.corrections!.offset, true);
    assert.equal((await c.records()).remainingPackages, 0);
    const offset = await c.db.get(
      'SELECT COUNT(*) AS n FROM document_corrections WHERE offset_operation_id IS NOT NULL',
    );
    assert.equal(Number(offset!.n), 1);
    console.log('B5C2_REVERSE shipments=2 correction=-10 compensation=90 stock=200/60000000g replay=once');
  } finally {
    await c.dispose();
  }
});
