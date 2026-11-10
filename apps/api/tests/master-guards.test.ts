import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B6a 停用覆盖四类引用，422带单号且全库不变', async () => {
  const c = await numberingFixture();
  try {
    const post = (path: string, body: object) =>
      c.web.post(`/api/v1/${path}`).set('origin', origin).set('idempotency-key', randomUUID()).send(body);
    const receipt = (await post('inbound', newReceipt()).expect(200)).body.data;
    const plan = (await post('outbound', newPlan()).expect(200)).body.data;
    const count = (await post('stocktakes', { warehouseCode: 'DEMO-WH', productCodes: ['ACR-032'] }).expect(200)).body
      .data;
    await c.db.run(
      "INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at) VALUES(?,'stock.adjust','DEMO-WH/ACR-032','未确认调整守卫验收','owner',UTC_TIMESTAMP(3))",
      [randomUUID()],
    );
    const before = await businessFingerprint(c.db);
    const response = await c.web
      .patch('/api/v1/master/products/ACR-032')
      .set('origin', origin)
      .send({ active: false })
      .expect(422);
    const refs = response.body.data.references as { kind: string; documentNo: string }[];
    assert.deepEqual([...new Set(refs.map((r) => r.kind))].sort(), ['adjustment', 'inbound', 'outbound', 'stocktake']);
    for (const number of [receipt.receiptNo, plan.orderNo, count.number, 'DEMO-WH/ACR-032'])
      assert.ok(refs.some((r) => r.documentNo === number));
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log(
      'B6A_FOUR_REFERENCE_GUARD',
      JSON.stringify({ status: response.status, data: response.body.data, databaseUnchanged: true }),
    );
  } finally {
    await c.dispose();
  }
});

test('B6a 停用与建单并发，不产生已停用商品的新引用', async () => {
  const c = await numberingFixture();
  try {
    const results = [];
    for (let i = 0; i < 8; i++) {
      const code = `RACE-${i}`;
      await c.web
        .post('/api/v1/master/products')
        .set('origin', origin)
        .send({ code, name: '停用并发验收' })
        .expect(200);
      const disable = () =>
        c.web.patch(`/api/v1/master/products/${code}`).set('origin', origin).send({ active: false });
      const create = () =>
        c.web
          .post('/api/v1/outbound')
          .set('origin', origin)
          .set('idempotency-key', randomUUID())
          .send({ ...newPlan(), lines: [{ productCode: code, plannedPackages: 1, plannedWeightGrams: 300000 }] });
      const responses = await Promise.all(i % 2 ? [create(), disable()] : [disable(), create()]);
      const [d, p] = i % 2 ? [responses[1]!, responses[0]!] : responses;
      const active = Number((await c.db.get('SELECT active FROM master_products WHERE code=?', [code]))?.active);
      const refs = Number((await c.db.get('SELECT COUNT(*) AS n FROM outbound_lines WHERE product_code=?', [code]))?.n);
      if (d!.status === 200) {
        assert.equal(active, 0);
        assert.equal(refs, 0);
        assert.equal(p!.status, 409);
      } else {
        assert.equal(d!.status, 422);
        assert.equal(p!.status, 200);
        assert.equal(active, 1);
        assert.equal(refs, 1);
      }
      results.push({ disable: d!.status, create: p!.status, active, references: refs });
    }
    console.log('B6A_DISABLE_CREATE_RACE', JSON.stringify(results));
  } finally {
    await c.dispose();
  }
});

test('B6a 字段白名单、档案归属、停用车辆和失败建单均原子拒绝', async () => {
  const c = await numberingFixture();
  try {
    const contact = (
      await c.web
        .post('/api/v1/master/contacts')
        .set('origin', origin)
        .send({ partyType: 'supplier', partyCode: 'DEMO-SUPPLIER', name: '送货人' })
        .expect(200)
    ).body.data;
    const vehicle = (
      await c.web.post('/api/v1/master/vehicles').set('origin', origin).send({ plate: '浙A00001' }).expect(200)
    ).body.data;
    await c.web
      .patch(`/api/v1/master/vehicles/${vehicle.id}`)
      .set('origin', origin)
      .send({ active: false })
      .expect(200);
    const before = await businessFingerprint(c.db);
    for (const body of [{ originKind: 'legacy' }, { inventoryEligible: true }, { categoryCode: '' }])
      await c.web.patch('/api/v1/master/products/ACR-032').set('origin', origin).send(body).expect(422);
    for (const body of [
      { ...newPlan(), contactId: contact.id },
      { ...newPlan(), vehicleNo: ' 浙a-00001 ' },
      { ...newPlan(), vehicleNo: '! @' },
    ])
      await c.web
        .post('/api/v1/outbound')
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send(body)
        .expect(422);
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log(
      'B6A_INPUT_GUARDS',
      JSON.stringify({
        forbiddenFields: 422,
        foreignContact: 422,
        disabledVehicle: 422,
        emptyNormalizedPlate: 422,
        databaseUnchanged: true,
      }),
    );
  } finally {
    await c.dispose();
  }
});

test('B6a 商品分类可以设置与清空，空字符串拒绝', async () => {
  const c = await numberingFixture();
  try {
    await c.web
      .post('/api/v1/master/categories')
      .set('origin', origin)
      .send({ code: 'FIBER', name: '腈纶' })
      .expect(200);
    const assigned = await c.web
      .patch('/api/v1/master/products/ACR-032')
      .set('origin', origin)
      .send({ categoryCode: 'FIBER' })
      .expect(200);
    assert.equal(assigned.body.data.categoryCode, 'FIBER');
    const cleared = await c.web
      .patch('/api/v1/master/products/ACR-032')
      .set('origin', origin)
      .send({ categoryCode: null })
      .expect(200);
    assert.equal(cleared.body.data.categoryCode, null);
    const before = await businessFingerprint(c.db);
    await c.web.patch('/api/v1/master/products/ACR-032').set('origin', origin).send({ categoryCode: '' }).expect(422);
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log('B6A_CATEGORY_CLEAR assigned=FIBER cleared=null empty=422 databaseUnchanged=true');
  } finally {
    await c.dispose();
  }
});
