import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reportTurnoverSchema } from '@wms/contracts';
import { dateFixture } from './date-correction-fixture.ts';

test('B5d-2 turnover restates outbound numerator while retaining posted inventory denominator', async () => {
  const f = await dateFixture('outbound');
  try {
    await f.db.run("UPDATE outbound_orders SET business_date='2026-01-15' WHERE id=?", [f.target.id]);
    await f.db.run(
      "UPDATE inventory_operations SET created_at='2026-01-15 02:00:00' WHERE operation_type='outbound.confirm'",
    );
    await f.db.run(
      `INSERT INTO document_date_corrections(id,document_kind,document_id,before_date,after_date,
      reason,actor,operation_id,created_at,revision) VALUES(?,'outbound',?,'2026-01-15','2026-02-15',
      '隔离重述验收','owner',?,'2026-03-01 00:00:00',1)`,
      [randomUUID(), f.target.id, randomUUID()],
    );
    const query = { source: 'erp-product', product: 'ACR-032', fromDay: '2026-02-01', toDay: '2026-02-28' };
    const read = async (basis: string) =>
      reportTurnoverSchema.parse(
        (
          await f.web
            .get('/api/v1/web/reports/turnover')
            .query({ ...query, basis })
            .expect(200)
        ).body.data,
      );
    const posted = await read('posted'),
      restated = await read('restated');
    assert.equal(posted.totals.netOutboundGrams, 0);
    assert.equal(restated.totals.netOutboundGrams, 302500);
    assert.equal(restated.totals.dailyClosingGramsSum, posted.totals.dailyClosingGramsSum);
    assert.equal(restated.items[0]!.averageInventory, posted.items[0]!.averageInventory);
    assert.match(restated.items[0]!.formula, /M 保持入账库存序列/);
  } finally {
    await f.dispose();
  }
});

test('B5d-2 historical asOf does not invent complete inventory days after the snapshot', async () => {
  const f = await dateFixture('outbound');
  try {
    const result = reportTurnoverSchema.parse(
      (
        await f.web
          .get('/api/v1/web/reports/turnover')
          .query({
            source: 'erp-product',
            product: 'ACR-032',
            fromDay: '2026-01-01',
            toDay: '2026-01-31',
            asOf: '2026-01-16T02:00:00Z',
          })
          .expect(200)
      ).body.data,
    );
    assert.equal(result.report.days, 15);
    assert.equal(result.report.countToDay, '2026-01-15');
    assert.equal(result.report.scopeStatus, 'incomplete');
  } finally {
    await f.dispose();
  }
});
