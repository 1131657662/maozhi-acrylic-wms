import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B6a 本地商品记账进入库存及报表，旧ERP子集不扩大；停用后调整盘点拒绝', async () => {
  const c = await numberingFixture();
  try {
    await c.web
      .post('/api/v1/master/products')
      .set('origin', origin)
      .send({ code: 'LOCAL-POST', name: '本地库存验收' })
      .expect(200);
    const post = (path: string, body: object) =>
      c.web.post(`/api/v1/${path}`).set('origin', origin).set('idempotency-key', randomUUID()).send(body);
    const receipt = (
      await post('inbound', {
        ...newReceipt(),
        lines: [{ productCode: 'LOCAL-POST', packages: 2, weightGrams: 500000 }],
      }).expect(200)
    ).body.data;
    await post(`inbound/${receipt.id}/confirm`, {}).expect(200);
    const inventory = (await c.web.get('/api/v1/stock/by-source?scope=inventory').expect(200)).body.data;
    const old = (await c.web.get('/api/v1/stock/by-source?source=erp-product').expect(200)).body.data;
    const row = inventory.items.find((r: { productCode: string }) => r.productCode === 'LOCAL-POST');
    assert.equal(row.packages, 2);
    assert.equal(row.weightGrams, 500000);
    assert.equal(
      old.items.some((r: { productCode: string }) => r.productCode === 'LOCAL-POST'),
      false,
    );
    const day = receipt.businessDate;
    const report = (
      await c.web
        .get('/api/v1/web/reports/monthly')
        .query({ scope: 'inventory', product: 'LOCAL-POST', fromDay: day, toDay: day })
        .expect(200)
    ).body.data;
    assert.equal(report.items.length, 1);
    assert.equal(report.items[0].inboundPackages, 2);
    await c.web.get('/api/v1/stock/by-source?scope=inventory&source=erp-product').expect(422);
    await c.web.patch('/api/v1/master/products/LOCAL-POST').set('origin', origin).send({ active: false }).expect(200);
    const before = await businessFingerprint(c.db);
    await post('stocktakes', { warehouseCode: 'DEMO-WH', productCodes: ['LOCAL-POST'] }).expect(409);
    await post('stock/adjustments', {
      warehouseCode: 'DEMO-WH',
      productCode: 'LOCAL-POST',
      packagesDelta: 1,
      weightDeltaGrams: 0,
      expected: { packages: 2, weightGrams: 500000 },
      reason: '停用守卫',
    }).expect(409);
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log(
      'B6A_LOCAL_INVENTORY_SCOPE',
      JSON.stringify({
        inventory: row,
        oldErpExcluded: true,
        report: report.items[0],
        disabledStocktake: 409,
        disabledAdjustment: 409,
        databaseUnchanged: true,
      }),
    );
  } finally {
    await c.dispose();
  }
});
