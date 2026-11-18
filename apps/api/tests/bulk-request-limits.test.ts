import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { JSON_BODY_BYTES, PAYLOAD_TOO_LARGE_MESSAGE } from '@wms/contracts';
import { numberingFixture, origin, newReceipt } from './numbering-fixture.ts';
import { countingFixture } from './scan-workbench-fixture.ts';
import { addV1Fixture } from './catalog-fixture.ts';

test('F04 合法入库十行各四百字，默认路由及批量上界仍返回中文 413', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    const lines = Array.from({ length: 10 }, (_, index) => ({
      productCode: `BULK-${index}`,
      packages: 2,
      weightGrams: 200000,
      memo: '收'.repeat(400),
    }));
    for (const { productCode } of lines)
      await db.run(
        `INSERT INTO master_products(code,name,active,created_at,updated_at,origin_kind,inventory_eligible)
      VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'local',1)`,
        [productCode, productCode],
      );
    const input = { ...newReceipt(), lines };
    assert.ok(Buffer.byteLength(JSON.stringify(input)) > JSON_BODY_BYTES.normal);
    const result = await web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send(input)
      .expect(200);
    assert.deepEqual(
      result.body.data.lines.map((line: { memo: string }) => line.memo),
      lines.map((line) => line.memo),
    );
    for (const [path, limit] of [
      ['/api/v1/inbound', JSON_BODY_BYTES.bulk],
      ['/api/v1/outbound/DEMO-001/scan-records/batch', JSON_BODY_BYTES.bulk],
      ['/api/v1/outbound', JSON_BODY_BYTES.normal],
    ] as const) {
      const rejected = await web
        .post(path)
        .send({ memo: 'x'.repeat(limit) })
        .expect(413);
      assert.equal(rejected.body.message, PAYLOAD_TOO_LARGE_MESSAGE);
    }
  } finally {
    await dispose();
  }
});

test('F04 两批各百条长码均通过真实清点路由，成功重放不重复写', async () => {
  const context = await countingFixture();
  try {
    const records = Array.from({ length: 200 }, (_, index) => ({
      barcode: String(index).padStart(64, '0'),
      productCode: 'ACR-032',
    }));
    for (const { barcode } of records)
      await addV1Fixture(context.db, { barcode, product: 'ACR-032', tonnes: '0.3000' });
    for (const batch of [records.slice(0, 100), records.slice(100)]) {
      const input = { records: batch, source: 'paste' };
      assert.ok(Buffer.byteLength(JSON.stringify(input)) > JSON_BODY_BYTES.normal);
      const key = randomUUID();
      const result = await context.post(input, key, '/batch').expect(200);
      assert.deepEqual(
        result.body.data.items.map((item: { ok: boolean; barcode: string }) => item.ok && item.barcode),
        batch.map((row) => row.barcode),
      );
      assert.deepEqual((await context.post(input, key, '/batch').expect(200)).body.data, result.body.data);
    }
    assert.equal(Number((await context.db.get('SELECT COUNT(*) n FROM scan_facts'))?.n), 200);
    assert.equal(Number((await context.db.get('SELECT COUNT(*) n FROM stock_journal'))?.n), 0);
  } finally {
    await context.dispose();
  }
});
