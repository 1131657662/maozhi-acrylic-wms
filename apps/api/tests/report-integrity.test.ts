import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMonthlySchema, reportDetailsSchema, listCellText, listFields } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';
import { addExact } from '../src/features/reports/arithmetic.ts';
import { localIso } from '../src/features/reports/normalize.ts';
import { nullableInt } from '../src/features/reports/source-values.ts';

test('B3b: unknown types and missing/invalid dates cannot silently become verified movements', async () => {
  const f = await reportFixture();
  try {
    await f.db.run(
      "UPDATE stock_journal SET source_business_type='opaque-type' WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1' AND source_business_type='check'",
    );
    const read = async (kind: string) =>
      (
        await f.api
          .get('/api/v1/web/reports/' + kind)
          .query({ ...reportParams, product: 'RPT-P1', warehouse: 'RPT-W1' })
          .set('Cookie', f.cookie)
          .expect(200)
      ).body.data;
    const monthly = reportMonthlySchema.parse(await read('monthly')),
      feb = monthly.items.find((r) => r.period === '2026-02')!;
    assert.equal(feb.unknownPackages, 2);
    assert.equal(feb.unknownGrams, 610000);
    assert.equal(feb.differenceGrams, 0);
    assert.equal(feb.checkState, '不可验证');
    assert.ok(feb.reasons.some((r) => r.includes('未分类库存变动')));
    assert.ok(feb.reasons.every((r) => !r.includes('opaque-type')));
    await f.db
      .run(`UPDATE stock_journal SET source_row_json=JSON_SET(source_row_json,'$.create_time','2026-02-30 10:00:00')
      WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1' AND source_business_type='inbound'`);
    const details = reportDetailsSchema.parse(await read('details'));
    assert.equal(details.report.missingTime, 2);
    assert.ok(details.items.every((r) => r.postedAt));
    assert.equal(details.total, 6);
    assert.equal(details.report.reconciliation.checkState, '不可验证');
    await f.db.run(`UPDATE stock SET source_row_json=JSON_SET(source_row_json,'$.stock_weight','invalid')
      WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1'`);
    const invalidAnchor = reportMonthlySchema.parse(await read('monthly'));
    assert.ok(invalidAnchor.items.every((r) => r.checkState === '不可验证'));
    assert.ok(invalidAnchor.items.every((r) => r.reasons.some((reason) => reason.includes('有效的导入时库存'))));
    console.log('B3B_INTEGRITY unknownType=retained invalidDates=2 excludedFromPeriods=2 state=unverifiable');
  } finally {
    await f.dispose();
  }
});

test('B3b: exact arithmetic and Shanghai calendar validation', () => {
  for (const missing of [null, undefined, '', ' ', false, {}, '0x10']) assert.equal(nullableInt(missing), null);
  assert.equal(nullableInt('0'), 0);
  assert.equal(
    listCellText(
      'inbound',
      listFields.inbound.find((f) => f.key === 'status')!,
      { status: null },
    ),
    '—',
  );
  assert.equal(localIso('2026-01-31 23:59:59.123456'), '2026-01-31T15:59:59.123Z');
  assert.equal(localIso('2026-02-30 10:00:00'), null);
  assert.equal(localIso('0000-01-01 00:00:00'), null);
  assert.equal(addExact(Number.MAX_SAFE_INTEGER, 1, -1), Number.MAX_SAFE_INTEGER);
  assert.throws(() => addExact(Number.MAX_SAFE_INTEGER, 1), /安全整数/);
});

test('B3b: document counts deduplicate journal lines and never guess missing references', async () => {
  const f = await reportFixture();
  try {
    await f.db.run(`UPDATE stock_journal SET source_order_no='REPORT-COUNT-ONLY'
      WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1' AND source_business_type='inbound' AND source_del_flag=0`);
    await f.db
      .run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_id,source_business_type,source_order_no,source_row_json)
      SELECT warehouse_code,product_code,packages_delta,tonnes_delta,created_at,UUID(),source_business_type,source_order_no,source_row_json
      FROM stock_journal WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1' AND source_business_type='inbound' AND created_at LIKE '2026-02%' LIMIT 1`);
    const response = await f.api
      .get('/api/v1/web/reports/monthly')
      .query({ ...reportParams, product: 'RPT-P1', warehouse: 'RPT-W1' })
      .set('Cookie', f.cookie)
      .expect(200);
    const rows = reportMonthlySchema.parse(response.body.data).items;
    assert.equal(rows.find((r) => r.period === '2026-02')!.inboundDocuments, 1);
    assert.equal(rows.find((r) => r.period === '2026-02')!.outboundDocuments, null);
    assert.equal(rows.find((r) => r.period === '2026-03')!.inboundReversals, 1);
    console.log('B3B_DOCUMENT_COUNTS repeatedLines=2 distinctDocuments=1 missingReference=null reversalOperations=1');
  } finally {
    await f.dispose();
  }
});
