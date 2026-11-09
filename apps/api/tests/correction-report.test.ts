import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reportMonthlySchema, reportDetailsSchema, shanghaiToday } from '@wms/contracts';
import { correctionFixture } from './correction-fixture.ts';
import { origin } from './numbering-fixture.ts';

for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind} 吨数独立更正/混合更正/撤销，收发量不污染`, async () => {
    const c = await correctionFixture(kind);
    try {
      const original = (await c.detail()).body.data;
      await c.post(await c.input({ packages: 0, weightGrams: 100000 })).expect(200);
      await c.post(await c.input({ packages: 1, weightGrams: -50000 })).expect(200);
      const summary = (await c.detail()).body.data.corrections;
      assert.deepEqual(summary.delta, { packages: 1, weightGrams: 50000 });
      const query = { source: 'erp-product', fromDay: shanghaiToday(), toDay: shanghaiToday(), product: 'ACR-032' };
      const read = async () =>
        reportMonthlySchema.parse((await c.web.get('/api/v1/web/reports/monthly').query(query).expect(200)).body.data)
          .items[0]!;
      const before = await read(),
        sign = kind === 'inbound' ? 1 : -1;
      assert.equal(before.correctionPackages, sign);
      assert.equal(before.correctionGrams, sign * 50000);
      assert.equal(before[`${kind}Packages`], summary.original.packages);
      assert.equal(before[`${kind}Grams`], summary.original.weightGrams);
      const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
      assert.equal(preview.allowed, true);
      await c.web
        .post(`${c.path}/reverse`)
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send({ reason: '更正后撤销与报表分类验收', expectedToken: preview.token })
        .expect(200);
      const after = await read();
      assert.equal(after[`${kind}Packages`], 0);
      assert.equal(after[`${kind}Grams`], 0);
      assert.equal(after.correctionPackages, 0);
      assert.equal(after.correctionGrams, 0);
      assert.equal(after.adjustmentPackages, 0);
      assert.equal(after.adjustmentGrams, 0);
      const details = reportDetailsSchema.parse(
        (await c.web.get('/api/v1/web/reports/details').query(query).expect(200)).body.data,
      );
      assert.equal(details.total, 2);
      const reversed = details.items.find((r) => r.operationType === `${kind}.reverse`)!;
      assert.equal(reversed.correctionOffsetPackages, -sign);
      assert.equal(reversed.correctionOffsetGrams, -sign * 50000);
      assert.deepEqual((await c.detail()).body.data.lines, original.lines);
      const net = await c.db.get(
        'SELECT SUM(packages_delta) AS packages,SUM(tonnes_delta) AS tonnes FROM stock_journal',
      );
      assert.equal(Number(net?.packages), 0);
      assert.equal(Number(net?.tonnes), 0);
      console.log(
        'B5A_REPORT_REVERSE',
        JSON.stringify({
          kind,
          correctionBeforeReverse: { packages: before.correctionPackages, grams: before.correctionGrams },
          movementBeforeReverse: { packages: before[`${kind}Packages`], grams: before[`${kind}Grams`] },
          movementAfterReverse: { packages: after[`${kind}Packages`], grams: after[`${kind}Grams`] },
          correctionAfterReverse: { packages: after.correctionPackages, grams: after.correctionGrams },
          net,
          originalUnchanged: true,
        }),
      );
    } finally {
      await c.dispose();
    }
  });
