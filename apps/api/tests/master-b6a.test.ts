import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B6a 新商品立刻可选可建单，出库引用停用422且库不变', async () => {
  const c = await numberingFixture();
  try {
    const product = (
      await c.web
        .post('/api/v1/master/products')
        .set('origin', origin)
        .send({ code: 'LOCAL-1', name: '本地腈纶', model: '规格甲' })
        .expect(200)
    ).body.data;
    assert.equal(product.originKind, 'local');
    assert.equal(product.inventoryEligible, true);
    const options = (await c.web.get('/api/v1/master/products?scope=inventory&status=active').expect(200)).body.data
      .items;
    assert.ok(options.some((row: { code: string }) => row.code === 'LOCAL-1'));
    const input = {
      ...newPlan(),
      vehicleNo: '浙 a·12345',
      lines: [{ productCode: 'LOCAL-1', plannedPackages: 2, plannedWeightGrams: 500000 }],
    };
    const plan = (
      await c.web
        .post('/api/v1/outbound')
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send(input)
        .expect(200)
    ).body.data;
    const receipt = (
      await c.web
        .post('/api/v1/inbound')
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send({ ...newReceipt(), lines: [{ productCode: 'LOCAL-1', packages: 2, weightGrams: 500000 }] })
        .expect(200)
    ).body.data;
    const before = await businessFingerprint(c.db);
    const rejection = await c.web
      .patch('/api/v1/master/products/LOCAL-1')
      .set('origin', origin)
      .send({ active: false })
      .expect(422);
    assert.ok(
      rejection.body.data.references.some(
        (r: { kind: string; documentNo: string }) => r.kind === 'outbound' && r.documentNo === plan.orderNo,
      ),
    );
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log(
      'B6A_PRODUCT_AND_DISABLE',
      JSON.stringify({
        product,
        selectable: true,
        inbound: receipt.receiptNo,
        outbound: plan.orderNo,
        status: rejection.status,
        response: rejection.body,
        databaseUnchanged: true,
      }),
    );
  } finally {
    await c.dispose();
  }
});
test('B6a 三联系人默认切换停用，历史快照不随客户商品档案改名', async () => {
  const c = await numberingFixture();
  try {
    const contacts = [];
    for (const name of ['甲', '乙', '丙'])
      contacts.push(
        (
          await c.web
            .post('/api/v1/master/contacts')
            .set('origin', origin)
            .send({
              partyType: 'customer',
              partyCode: 'DEMO-CUST-1',
              name,
              phone: '13800000000',
              address: `${name}地址`,
            })
            .expect(200)
        ).body.data,
      );
    const make = async () =>
      (
        await c.web
          .post('/api/v1/outbound')
          .set('origin', origin)
          .set('idempotency-key', randomUUID())
          .send({ ...newPlan(), customerCode: 'DEMO-CUST-1' })
          .expect(200)
      ).body.data;
    const evidence = [];
    for (const contact of contacts.slice(0, 2)) {
      await c.web.put(`/api/v1/master/contacts/${contact.id}/default`).set('origin', origin).send({}).expect(200);
      const plan = await make();
      assert.equal(plan.shipToName, contact.name);
      evidence.push({ default: contact.name, actual: plan.shipToName, id: plan.id });
    }
    await c.web
      .patch(`/api/v1/master/contacts/${contacts[1].id}`)
      .set('origin', origin)
      .send({ active: false })
      .expect(200);
    const fallback = await make();
    assert.equal(fallback.shipToName, '甲');
    await c.web
      .patch('/api/v1/master/customers/DEMO-CUST-1')
      .set('origin', origin)
      .send({ name: '客户新名' })
      .expect(200);
    await c.web
      .patch('/api/v1/master/products/ACR-032')
      .set('origin', origin)
      .send({ name: '商品新名', model: '规格新' })
      .expect(200);
    await c.web
      .patch(`/api/v1/master/contacts/${contacts[0].id}`)
      .set('origin', origin)
      .send({ name: '联系人新名' })
      .expect(200);
    const old = (await c.web.get(`/api/v1/outbound/${fallback.id}`).expect(200)).body.data;
    assert.equal(old.customerName, fallback.customerName);
    assert.deepEqual(old.lines, fallback.lines);
    assert.equal(old.shipToName, '甲');
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM party_contact_defaults WHERE party_code='DEMO-CUST-1'"))?.n),
      0,
    );
    console.log(
      'B6A_CONTACT_SNAPSHOT',
      JSON.stringify({
        evidence,
        afterDisable: fallback.shipToName,
        oldCustomer: old.customerName,
        currentCustomer: '客户新名',
        oldProduct: old.lines[0].productName,
        currentProduct: '商品新名',
        oldContact: old.shipToName,
        currentContact: '联系人新名',
      }),
    );
  } finally {
    await c.dispose();
  }
});
test('B6a 同归一化车牌并发保存只建一车，重放不增使用次数', async () => {
  const c = await numberingFixture();
  try {
    const key = randomUUID(),
      body = { ...newPlan(), vehicleNo: '浙 a·12345' };
    const post = (input: object, k: string) =>
      c.web.post('/api/v1/outbound').set('origin', origin).set('idempotency-key', k).send(input);
    const result = await Promise.all([post(body, key), post({ ...body, vehicleNo: '浙A-12345' }, randomUUID())]);
    assert.deepEqual(
      result.map((row) => row.status),
      [200, 200],
    );
    await post(body, key).expect(200);
    const vehicles = await c.db.all('SELECT plate_normalized,source,use_count FROM master_vehicles');
    assert.deepEqual(vehicles, [{ plate_normalized: '浙A12345', source: 'auto', use_count: 2 }]);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM vehicle_document_uses'))?.n), 2);
    console.log(
      'B6A_VEHICLE_CONCURRENCY',
      JSON.stringify({ statuses: result.map((row) => row.status), vehicles, replayUseCount: 2 }),
    );
  } finally {
    await c.dispose();
  }
});
