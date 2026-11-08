import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMonthlySchema, reportDetailsSchema } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';

test('B4a R6 constructor/__proto__ 保留原类型并回退未分类，月报不可验证', async () => {
  const f = await reportFixture();
  try {
    for (const type of ['constructor', '__proto__']) {
      await f.db.run(
        "UPDATE stock_journal SET source_business_type=? WHERE product_code='RPT-P1' AND warehouse_code='RPT-W1' AND source_business_type IN ('check','constructor','__proto__')",
        [type],
      );
      const read = async (kind: string) =>
        (
          await f.api
            .get(`/api/v1/web/reports/${kind}`)
            .query({ ...reportParams, product: 'RPT-P1', warehouse: 'RPT-W1' })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body;
      const details = reportDetailsSchema.parse((await read('details')).data);
      // 出入库明细仅列入/出事件；未知类型仍进入对账及月报质量提示。
      assert.ok(details.items.every((item) => item.operationType !== type));
      assert.equal(details.report.reconciliation.checkState, '不可验证');
      const monthly = reportMonthlySchema.parse((await read('monthly')).data);
      const feb = monthly.items.find((item) => item.period === '2026-02');
      assert(feb);
      assert.equal(feb.unknownPackages, 2);
      assert.equal(feb.unknownGrams, 610000);
      assert.equal(feb.checkState, '不可验证');
      assert.ok(feb.reasons.some((reason) => reason.includes(type)));
      console.log(
        'B4A_R6_REPORT',
        JSON.stringify({ type, httpStatus: 200, detailReconciliation: details.report.reconciliation, monthly: feb }),
      );
    }
  } finally {
    await f.dispose();
  }
});
