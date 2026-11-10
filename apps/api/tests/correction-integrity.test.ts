import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { correctionFixture, expectUnchanged } from './correction-fixture.ts';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B5a 空原因、无变化、跨原单行/前序均拒绝且全库不变', async () => {
  const c = await correctionFixture();
  try {
    const input = await c.input();
    const results = [
      await expectUnchanged(c, { ...input, reason: ' ' }, 422),
      await expectUnchanged(c, await c.input({ packages: 0, weightGrams: 0 }), 422),
      await expectUnchanged(c, { ...input, previousCorrectionId: randomUUID() }, 409),
      await expectUnchanged(
        c,
        { ...input, lines: [{ ...input.lines[0], originalLineId: 'other-document-line' }] },
        422,
      ),
    ];
    console.log(
      'B5A_INTEGRITY',
      JSON.stringify({ cases: ['empty_reason', 'no_change', 'foreign_previous', 'foreign_line'], results }),
    );
  } finally {
    await c.dispose();
  }
});

for (const prior of [false, true])
  test(`B5a ${prior ? '更正' : '原单'}流水证据被破坏则拒绝`, async () => {
    const c = await correctionFixture();
    try {
      if (prior) await c.post(await c.input()).expect(200);
      const input = await c.input();
      await c.db.run(
        `UPDATE stock_journal SET packages_delta=packages_delta+1,packages_after=packages_after+1 WHERE correction_id IS ${prior ? 'NOT NULL' : 'NULL'}`,
      );
      const result = await expectUnchanged(c, input, 409);
      assert.equal(result.code, prior ? 'CORRECTION_EVIDENCE_INVALID' : 'ORIGINAL_EVIDENCE_MISSING');
      console.log('B5A_EVIDENCE_GUARD', JSON.stringify({ prior, ...result }));
    } finally {
      await c.dispose();
    }
  });

test('B5a 多行更正第二行负库存，第一行及所有表不写入', async () => {
  const c = await numberingFixture();
  try {
    await c.db.run(
      "INSERT INTO master_products(code,name,source_kind,active,created_at,updated_at,origin_kind,inventory_eligible) VALUES('B5A-SECOND','合成第二商品','erp-product',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)",
    );
    const response = await c.web
      .post('/api/v1/inbound')
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({
        ...newReceipt(),
        lines: [...newReceipt().lines, { productCode: 'B5A-SECOND', packages: 2, weightGrams: 400000 }],
      })
      .expect(200);
    const id = response.body.data.id;
    await c.web
      .post(`/api/v1/inbound/${id}/confirm`)
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({})
      .expect(200);
    // Simulate later consumption in this disposable DB; correction must preflight both cells.
    await c.db.run("UPDATE stock SET packages=0,weight_tonnes=0 WHERE product_code='B5A-SECOND'");
    const lines = (await c.web.get(`/api/v1/inbound/${id}`).expect(200)).body.data.corrections.lines;
    const before = await businessFingerprint(c.db);
    const result = await c.web
      .post(`/api/v1/inbound/${id}/corrections`)
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({
        expectedCorrectionRevision: 0,
        previousCorrectionId: null,
        reason: '多行原子验收',
        lines: lines.map(
          (line: {
            originalLineId: string;
            productCode: string;
            effective: { packages: number; weightGrams: number };
          }) => ({
            originalLineId: line.originalLineId,
            packages: line.effective.packages + (line.productCode === 'B5A-SECOND' ? -1 : 1),
            weightGrams: line.effective.weightGrams,
          }),
        ),
      })
      .expect(409);
    assert.equal(result.body.code, 'INSUFFICIENT_STOCK');
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log(
      'B5A_MULTILINE',
      JSON.stringify({ status: result.status, code: result.body.code, databaseUnchanged: true }),
    );
  } finally {
    await c.dispose();
  }
});
