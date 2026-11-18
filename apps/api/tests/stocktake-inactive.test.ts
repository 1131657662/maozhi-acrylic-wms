import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { assertNoBook } from './stocktake-blind-fixture.ts';

for (const mode of ['open', 'blind']) {
  test(`F01 全仓 ${mode} 纳入停用有余额、排除停用零余额，账实一致可回写`, async () => {
    const { db, web, dispose } = await numberingFixture();
    const post = (path: string, body: object) =>
      web.post(path).set('Origin', origin).set('Idempotency-Key', randomUUID()).send(body);
    try {
      await db.run("UPDATE master_products SET active=0 WHERE code='ACR-032'");
      await db.run(`INSERT INTO master_products(code,name,active,created_at,updated_at,origin_kind,inventory_eligible)
        VALUES('EMPTY','停用零余额',0,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'local',1)`);
      await db.run(
        "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH','EMPTY',0,0)",
      );
      const created = await post('/api/v1/stocktakes', { warehouseCode: 'DEMO-WH', mode }).expect(200);
      const base = `/api/v1/stocktakes/${created.body.data.id}`;
      const lines = await web.get(`${base}/lines`).expect(200);
      assert.deepEqual(
        lines.body.data.items.map((line: { productCode: string }) => line.productCode),
        ['ACR-032'],
      );
      const saved = await web
        .put(`${base}/lines/ACR-032`)
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ expectedRevision: 0, actual: { packages: 6, weightGrams: 1800000 } })
        .expect(200);
      if (mode === 'blind') {
        for (const response of [created, lines, saved, await web.get(`${base}/preview`).expect(409)])
          assertNoBook(response.body);
        await post(`${base}/reveal`, { expectedRevision: 1 }).expect(200);
      }
      const preview = await web.get(`${base}/preview`).expect(200);
      assert.deepEqual(preview.body.data.blockers, []);
      await db.run("UPDATE stock SET weight_tonnes=0.001 WHERE product_code='EMPTY'");
      const drift = await web.get(`${base}/preview`).expect(200);
      assert.ok(drift.body.data.blockers.some((blocker: { code: string }) => blocker.code === 'STOCKTAKE_STOCK_DRIFT'));
      await db.run("UPDATE stock SET weight_tonnes=0 WHERE product_code='EMPTY'");
      const completed = await post(`${base}/post`, {
        expectedToken: preview.body.data.token,
        reason: '人工核对一致',
      }).expect(200);
      assert.equal(completed.body.data.status, 'completed');
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM stock_journal'))?.n), 0);
    } finally {
      await dispose();
    }
  });
}
