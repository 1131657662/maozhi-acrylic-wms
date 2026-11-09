import test from 'node:test';
import assert from 'node:assert/strict';
import { reportAgingSchema, reportTurnoverSchema } from '@wms/contracts';
import { derivedReportFixture } from './report-fixture.ts';

test('B3c: daily carry-forward turnover agrees with an independent recursive SQL calculation', async () => {
  const f = await derivedReportFixture();
  try {
    const query = {
      source: 'erp-product', fromDay: '2026-04-01', toDay: '2026-04-06', product: 'B3C-DAY',
      page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
    };
    const response = await f.api.get('/api/v1/web/reports/turnover').query(query).set('Cookie', f.cookie).expect(200),
      report = reportTurnoverSchema.parse(response.body.data),
      row = report.items[0]!;
    const sqlDays = await f.db.all(
      `WITH RECURSIVE days AS (
        SELECT DATE('2026-04-01') AS day
        UNION ALL SELECT day + INTERVAL 1 DAY FROM days WHERE day < DATE('2026-04-06')
      ), daily AS (
        SELECT d.day, (
          SELECT ROUND(s.tonnes_after * 1000000)
          FROM stock_journal s WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-DAY'
            AND s.source_del_flag=0
            AND s.created_at < DATE_SUB(DATE_ADD(d.day, INTERVAL 1 DAY), INTERVAL 8 HOUR)
          ORDER BY s.id DESC LIMIT 1
        ) AS closingGrams
        FROM days d
      ) SELECT COUNT(*) AS days, SUM(closingGrams) AS sumGrams FROM daily`,
    );
    const sqlFlow = await f.db.get(
      `SELECT SUM(CASE WHEN o.operation_type IN ('outbound.confirm','outbound.reverse')
          THEN -ROUND(s.tonnes_delta * 1000000) ELSE 0 END) AS netOutboundGrams,
        SUM(o.operation_type='stock.adjust') AS adjustmentCount,
        COUNT(DISTINCT CASE WHEN o.operation_type='stocktake.post' THEN o.id END) AS stocktakeCount
      FROM stock_journal s JOIN inventory_operations o ON o.id=s.operation_id
      WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-DAY'
        AND s.created_at>='2026-04-01 00:00:00' AND s.created_at<'2026-04-07 00:00:00'
        AND o.operation_type IN ('outbound.confirm','outbound.reverse','stock.adjust','stocktake.post')`,
    );
    assert.equal(Number(sqlDays[0]!.days), row.days);
    assert.equal(Number(sqlDays[0]!.sumGrams), row.dailyClosingGramsSum);
    assert.equal(Number(sqlFlow?.netOutboundGrams), row.netOutboundGrams);
    assert.equal(Number(sqlFlow?.adjustmentCount), row.adjustmentCount);
    assert.equal(Number(sqlFlow?.stocktakeCount), row.stocktakeCount);
    assert.equal(row.dailyClosingGramsSum, 57_000_000);
    assert.equal(row.netOutboundGrams, 4_000_000);
    assert.equal(row.averageInventory, '9.5000');
    assert.equal(row.turns, '0.4211');
    assert.equal(row.turnoverDays, '14.3');
    assert.equal(row.adjustmentSummary, '本期含调整 1 笔、含盘点回写 1 次');
    console.log('B3C_TURNOVER_SQL', JSON.stringify({ days: sqlDays[0], flows: sqlFlow, checks: 'all equal', differences: 0 }));
  } finally {
    await f.dispose();
  }
});

test('B3c: partial FIFO allocation agrees with an independent cumulative-layer SQL calculation', async () => {
  const f = await derivedReportFixture();
  try {
    const query = {
      source: 'erp-product', fromDay: '2026-02-02', toDay: '2026-03-02', cutoffDay: '2026-03-02',
      product: 'B3C-FIFO', page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
    };
    const response = await f.api.get('/api/v1/web/reports/aging').query(query).set('Cookie', f.cookie).expect(200),
      report = reportAgingSchema.parse(response.body.data),
      row = report.items[0]!;
    const sql = await f.db.get(
      `WITH inbound AS (
        SELECT s.id, DATE(DATE_ADD(o.created_at,INTERVAL 8 HOUR)) AS ageDay,
          ROUND(s.tonnes_delta*1000000) AS grams,
          SUM(ROUND(s.tonnes_delta*1000000)) OVER(ORDER BY s.id) AS cumulativeGrams
        FROM stock_journal s JOIN inventory_operations o ON o.id=s.operation_id
        WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-FIFO' AND o.operation_type='inbound.confirm'
      ), outbound AS (
        SELECT COALESCE(SUM(-ROUND(s.tonnes_delta*1000000)),0) AS grams
        FROM stock_journal s JOIN inventory_operations o ON o.id=s.operation_id
        WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-FIFO' AND o.operation_type='outbound.confirm'
          AND DATE(DATE_ADD(o.created_at,INTERVAL 8 HOUR))<='2026-03-02'
      ), remaining AS (
        SELECT i.ageDay, i.grams-GREATEST(0,LEAST(i.grams,o.grams-(i.cumulativeGrams-i.grams))) AS grams
        FROM inbound i CROSS JOIN outbound o
      ) SELECT
        SUM(CASE WHEN DATEDIFF('2026-03-02',ageDay)<=30 THEN grams ELSE 0 END) AS age0To30,
        SUM(CASE WHEN DATEDIFF('2026-03-02',ageDay) BETWEEN 31 AND 90 THEN grams ELSE 0 END) AS age31To90,
        SUM(grams) AS closingGrams
      FROM remaining`,
    );
    assert.equal(Number(sql?.age0To30), row.age0To30Grams);
    assert.equal(Number(sql?.age31To90), row.age31To90Grams);
    assert.equal(Number(sql?.closingGrams), row.closingGrams);
    assert.equal(row.age0To30Grams, 3_000_000);
    assert.equal(row.age31To90Grams, 0);
    assert.equal(row.unagedGrams, 0);
    console.log('B3C_FIFO_SQL', JSON.stringify({ sql, report: { age0To30: row.age0To30Grams, age31To90: row.age31To90Grams, unaged: row.unagedGrams }, differences: 0 }));
  } finally {
    await f.dispose();
  }
});

test('B3c: outbound restore preserves original FIFO layers; consumed inbound reversal becomes unaged', async () => {
  const f = await derivedReportFixture();
  try {
    const query = {
      source: 'erp-product', fromDay: '2026-02-02', toDay: '2026-03-03', cutoffDay: '2026-03-03',
      product: 'B3C-COMP', page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
    };
    const response = await f.api.get('/api/v1/web/reports/aging').query(query).set('Cookie', f.cookie).expect(200),
      row = reportAgingSchema.parse(response.body.data).items[0]!;
    const sql = await f.db.get(
      `SELECT (SELECT ROUND(s.tonnes_after*1000000) FROM stock_journal s
          WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-COMP' ORDER BY s.id DESC LIMIT 1) AS closingGrams,
        SUM(ROUND(s.tonnes_delta*1000000)) AS netDeltaGrams,
        COUNT(DISTINCT c.id) AS compensationCount
      FROM stock_journal s JOIN inventory_operations o ON o.id=s.operation_id
      LEFT JOIN document_closures c ON c.compensation_operation_id=o.id
      WHERE s.warehouse_code='B3C-WH' AND s.product_code='B3C-COMP'`,
    );
    assert.equal(Number(sql?.closingGrams), row.closingGrams);
    assert.equal(Number(sql?.netDeltaGrams), Number(sql?.closingGrams));
    assert.equal(Number(sql?.compensationCount), 2);
    assert.deepEqual(
      [row.age0To30Grams, row.age31To90Grams, row.age91To180Grams, row.age181To365Grams, row.ageOver365Grams],
      [null, null, null, null, null],
    );
    assert.equal(row.unagedGrams, 5_000_000);
    assert.equal(row.checkState, '不可验证');
    console.log('B3C_COMPENSATION_SQL', JSON.stringify({ sql, report: { buckets: 'null', unaged: row.unagedGrams }, differences: 0 }));
  } finally {
    await f.dispose();
  }
});

test('B3c: no outbound, zero average, zero closing, and today-incomplete boundaries stay finite', async () => {
  const f = await derivedReportFixture();
  try {
    const turnover = async (product: string, fromDay: string, toDay: string) => {
      const response = await f.api.get('/api/v1/web/reports/turnover').query({
        source: 'erp-product', fromDay, toDay, product, page: '1', pageSize: '20',
        sortBy: 'warehouseCode', direction: 'asc',
      }).set('Cookie', f.cookie).expect(200);
      return reportTurnoverSchema.parse(response.body.data);
    };
    const noOutbound = (await turnover('B3C-NOOUT', '2026-04-01', '2026-04-03')).items[0]!,
      sameDay = (await turnover('B3C-ZERO', '2026-04-08', '2026-04-08')).items[0]!,
      today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
      todayStart = await turnover('B3C-DAY', today, today),
      agingResponse = await f.api.get('/api/v1/web/reports/aging').query({
        source: 'erp-product', fromDay: '2026-04-08', toDay: '2026-04-08', cutoffDay: '2026-04-08',
        product: 'B3C-ZERO', page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
      }).set('Cookie', f.cookie).expect(200),
      zeroAge = reportAgingSchema.parse(agingResponse.body.data).items[0]!;
    assert.equal(noOutbound.turns, '0.0000');
    assert.equal(noOutbound.turnoverDays, null);
    assert.equal(noOutbound.averageInventory, '5.0000');
    assert.equal(sameDay.averageInventory, '0.0000');
    assert.equal(sameDay.turns, null);
    assert.equal(sameDay.turnoverDays, null);
    assert.equal(todayStart.report.scopeStatus, 'incomplete');
    assert.equal(todayStart.report.days, 0);
    assert.deepEqual(
      [zeroAge.age0To30Grams, zeroAge.age31To90Grams, zeroAge.age91To180Grams, zeroAge.age181To365Grams, zeroAge.ageOver365Grams, zeroAge.unagedGrams],
      [0, 0, 0, 0, 0, 0],
    );
    console.log('B3C_BOUNDARIES', JSON.stringify({ noOutbound: noOutbound.turns, zeroAverage: sameDay.averageInventory, zeroClosing: zeroAge.closingGrams, today: todayStart.report.scopeStatus }));
  } finally {
    await f.dispose();
  }
});
