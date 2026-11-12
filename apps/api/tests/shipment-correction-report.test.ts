import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportMonthlySchema, reportDetailsSchema, shanghaiToday } from '@wms/contracts';
import { shipmentCorrectionFixture, correctionInput } from './shipment-correction-fixture.ts';
import { correctionFixture } from './correction-fixture.ts';

test('B5c-2 outbound effective report equals detail and full signed outbound ledger in the same period', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 50)).expect(200);
    const query = { source: 'erp-product', fromDay: shanghaiToday(), toDay: shanghaiToday(), product: 'ACR-032' };
    const result = reportMonthlySchema.parse(
      (await c.web.get('/api/v1/web/reports/monthly').query(query).expect(200)).body.data,
    );
    const month = result.items[0]!;
    assert.equal(month.outboundPackages, 90);
    assert.equal(month.outboundGrams, 27000000);
    assert.equal(month.adjustmentPackages, 0);
    assert.equal(month.correctionPackages, 10);
    const ledger = await c.db.get(
      `SELECT -SUM(j.packages_delta) AS packages,-SUM(j.tonnes_delta)*1000000 AS grams
      FROM stock_journal j JOIN inventory_operations o ON o.id=j.operation_id
      LEFT JOIN document_corrections c ON c.id=j.correction_id
      WHERE (o.operation_type IN ('outbound.confirm','outbound.reverse') OR c.outbound_order_id IS NOT NULL)
      AND DATE(DATE_ADD(o.created_at,INTERVAL 8 HOUR))=? AND j.source_del_flag=0`,
      [shanghaiToday()],
    );
    assert.equal(month.outboundPackages, Number(ledger!.packages));
    assert.equal(month.outboundGrams, Number(ledger!.grams));
    assert.equal(month.outboundPackages, (await c.current()).corrections!.effective.packages);
    const details = reportDetailsSchema.parse(
      (
        await c.web
          .get('/api/v1/web/reports/details')
          .query({ ...query, movement: 'outbound' })
          .expect(200)
      ).body.data,
    );
    assert.equal(details.total, 3);
    assert.equal(
      details.items.reduce((sum, row) => sum + row.packages, 0),
      90,
    );
    assert.equal(details.items.find((row) => row.operationType === 'stock.correct')!.operationLabel, '出库更正');
    assert.equal(month.outboundDocuments, 1);
    console.log(
      'B5C2_REPORT outbound=-10 effective=90/27000000g detail=90/27000000g ledger=90/27000000g adjustment=0 documents=1',
    );
    await c.db.run(
      "UPDATE inventory_operations SET created_at='2026-09-15 02:00:00' WHERE operation_type='outbound.confirm'",
    );
    await c.db.run(
      "UPDATE inventory_operations SET created_at='2026-10-15 02:00:00' WHERE operation_type='stock.correct'",
    );
    const crossMonth = reportMonthlySchema.parse(
      (
        await c.web
          .get('/api/v1/web/reports/monthly')
          .query({ ...query, fromDay: '2026-09-01', toDay: '2026-10-31' })
          .expect(200)
      ).body.data,
    );
    const sept = crossMonth.items.find((row) => row.period === '2026-09')!,
      oct = crossMonth.items.find((row) => row.period === '2026-10')!;
    assert.equal(sept.outboundPackages, 100);
    assert.equal(oct.outboundPackages, -10);
    assert.equal(oct.adjustmentPackages, 0);
    assert.equal(sept.outboundPackages + oct.outboundPackages, month.outboundPackages);
    console.log('B5C2_REPORT outbound_cross_month original_month=100 correction_month=-10 adjustment=0');
  } finally {
    await c.dispose();
  }
});

test('B5c-2 inbound negative correction reduces effective inbound without adjustment and posts to correction month', async () => {
  const c = await correctionFixture('inbound');
  try {
    // Keep the original receipt immutable; increase its effective quantity before testing a later-month reduction.
    await c.post(await c.input({ packages: 10, weightGrams: 0 })).expect(200);
    const first = (await c.detail()).body.data.corrections;
    const response = await c.post(await c.input({ packages: -5, weightGrams: 0 })).expect(200);
    const lastId = response.body.data.id;
    await c.db.run(
      "UPDATE inventory_operations SET created_at='2026-09-15 02:00:00' WHERE operation_type IN ('inbound.confirm','stock.correct')",
    );
    await c.db.run("UPDATE inventory_operations SET created_at='2026-10-15 02:00:00' WHERE id=?", [
      response.body.data.operationId,
    ]);
    const result = reportMonthlySchema.parse(
      (
        await c.web
          .get('/api/v1/web/reports/monthly')
          .query({ source: 'erp-product', fromDay: '2026-09-01', toDay: '2026-10-31', product: 'ACR-032' })
          .expect(200)
      ).body.data,
    );
    const sept = result.items.find((row) => row.period === '2026-09')!,
      oct = result.items.find((row) => row.period === '2026-10')!;
    assert.equal(sept.inboundPackages, first.effective.packages);
    assert.equal(oct.inboundPackages, -5);
    assert.equal(oct.adjustmentPackages, 0);
    assert.equal(oct.adjustmentGrams, 0);
    assert.equal(
      sept.inboundPackages + oct.inboundPackages,
      (await c.detail()).body.data.corrections.effective.packages,
    );
    assert.ok(lastId);
    console.log(
      `B5C2_REPORT inbound_correction=-5 original_month=${sept.inboundPackages} correction_month=-5 adjustment=0`,
    );
  } finally {
    await c.dispose();
  }
});
