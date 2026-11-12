import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDetailsSchema, reportMonthlySchema, shanghaiToday } from '@wms/contracts';
import { correctionFixture } from './correction-fixture.ts';
import { commandFor } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B5d-2 ${kind} corrections and reversal each contribute once in both bases`, async () => {
    const c = await correctionFixture(kind);
    try {
      await c.post(await c.input({ packages: 1, weightGrams: 50000 })).expect(200);
      const effective = (await c.detail()).body.data.corrections.effective;
      await executeLifecycle(c.db, await commandFor(c.db, c.target));
      await c.db.run("UPDATE inventory_operations SET created_at='2026-01-15 02:00:00' WHERE operation_type=?", [
        `${kind}.confirm`,
      ]);
      await c.db.run(
        "UPDATE inventory_operations SET created_at='2026-02-15 02:00:00' WHERE operation_type='stock.correct'",
      );
      const query = {
        source: 'erp-product',
        product: 'ACR-032',
        fromDay: '2026-01-01',
        toDay: shanghaiToday(),
        pageSize: '200',
      };
      for (const basis of ['posted', 'restated']) {
        const monthly = reportMonthlySchema.parse(
          (
            await c.web
              .get('/api/v1/web/reports/monthly')
              .query({ ...query, basis })
              .expect(200)
          ).body.data,
        );
        const detail = reportDetailsSchema.parse(
          (
            await c.web
              .get('/api/v1/web/reports/details')
              .query({ ...query, basis })
              .expect(200)
          ).body.data,
        );
        assert.equal(detail.total, 3);
        assert.equal(
          detail.items.reduce((sum, row) => sum + row.packages, 0),
          0,
        );
        assert.equal(
          detail.items.reduce((sum, row) => sum + row.weightGrams, 0),
          0,
        );
        assert.equal(
          detail.items.find((row) => row.operationType === `${kind}.reverse`)!.packages,
          -effective.packages,
        );
        assert.equal(
          monthly.items.reduce((sum, row) => sum + row[`${kind}Packages`], 0),
          0,
        );
        if (monthly.bridge)
          assert.equal(
            monthly.bridge.reduce((sum, row) => sum + row.deltaGrams, 0),
            0,
          );
      }
    } finally {
      await c.dispose();
    }
  });
}
