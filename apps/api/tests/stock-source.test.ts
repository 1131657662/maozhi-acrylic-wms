import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { sourceStockSchema, stockSchema, sourceJournalSchema } from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';
import { seedSourceEvidence } from '../../../scripts/e2e-source-fixtures.ts';
import { logger } from '../src/shared/logger.ts';

test('来源契约防混源：同名/误导前缀不合并，软删和条码重量不入 ERP 小计', async () => {
  const context = await numberingFixture();
  try {
    await seedSourceEvidence(context.db);
    for (const [source, packages, weightGrams] of [
      ['erp-product', 24, 7246000],
      ['sku-spec', 30, 9144000],
    ] as const) {
      const response = await context.web.get(`/api/v1/stock/by-source?source=${source}`).expect(200);
      const data = sourceStockSchema.parse(response.body.data);
      assert.deepEqual(data.subtotal, { packages, weightGrams });
      assert.equal(data.items.length, source === 'erp-product' ? 3 : 2);
      assert.ok(data.items.every((row) => row.source === source && row.sourceKind === source));
      assert.deepEqual(Object.keys(data).sort(), ['items', 'source', 'subtotal']);
      console.log(`B1A2_SOURCE ${JSON.stringify(data)}`);
    }
    const unknown = (await context.web.get('/api/v1/stock/by-source?source=unclassified').expect(200)).body.data;
    assert.equal(unknown.subtotal, null);
    assert.ok(unknown.items.some((row: { productCode: string }) => row.productCode === 'SRC-MISSING'));
    assert.equal(unknown.items.length, 2);
    const journal = sourceJournalSchema.parse(
      (await context.web.get('/api/v1/stock/by-source/journal?source=sku-spec').expect(200)).body.data,
    );
    assert.equal(journal.items.length, 2);
    assert.ok(journal.items.every((row) => row.source === 'sku-spec'));
  } finally {
    await context.dispose();
  }
});

test('来源查询拒绝遗漏/all/多来源参数，契约拒绝混源及额外总计字段', async () => {
  const context = await numberingFixture();
  try {
    for (const query of ['', '?source=all', '?source=erp-product&source=sku-spec', '?source=erp-product&total=true']) {
      await context.web.get(`/api/v1/stock/by-source${query}`).expect(422);
      await context.web.get(`/api/v1/stock/by-source/journal${query}`).expect(422);
    }
    const data = { source: 'erp-product', items: [], subtotal: { packages: 0, weightGrams: 0 } };
    assert.equal(sourceStockSchema.safeParse({ ...data, total: 0 }).success, false);
    assert.equal(sourceStockSchema.safeParse({ ...data, source: 'unclassified' }).success, false);
    assert.equal(
      sourceStockSchema.safeParse({
        ...data,
        items: [
          {
            source: 'sku-spec',
            sourceKind: 'sku-spec',
            productCode: 'SPEC',
            productName: 'test',
            warehouseCode: 'test',
            packages: 1,
            weightGrams: 300000,
          },
        ],
      }).success,
      false,
    );
    console.log('B1A2_SCOPE_GUARD missing/all/multiple/total=422; mixed_response=false; grand_total=false');
  } finally {
    await context.dispose();
  }
});

test('旧 stock 数组契约及三个登录渠道不变，新来源端点仅 Web 可用', async () => {
  const context = await numberingFixture();
  try {
    const before = stockSchema.parse((await context.web.get('/api/v1/stock').expect(200)).body.data);
    for (const channel of ['pda', 'miniapp'] as const) {
      const login = await request(context.app)
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      const auth = `Bearer ${login.body.data.token}`;
      const result = await request(context.app).get('/api/v1/stock').set('Authorization', auth).expect(200);
      assert.deepEqual(stockSchema.parse(result.body.data), before);
      await request(context.app)
        .get('/api/v1/stock/by-source?source=erp-product')
        .set('Authorization', auth)
        .expect(403);
      await request(context.app)
        .get('/api/v1/stock/by-source/journal?source=erp-product')
        .set('Authorization', auth)
        .expect(403);
    }
    await request(context.app).get('/api/v1/stock/by-source?source=erp-product').expect(401);
    console.log('B1A2_COMPAT web/pda/miniapp legacy_stock=unchanged; scoped_nonweb=403; anonymous=401');
  } finally {
    await context.dispose();
  }
});

test('可执行 SQL 防混源对账：异常非 ERP 夹具不影响 ERP 数值', async () => {
  const context = await numberingFixture();
  try {
    await seedSourceEvidence(context.db);
    const sql = readFileSync(new URL('../../../scripts/sql/verify-stock-sources.sql', import.meta.url), 'utf8');
    const statements = sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
    const scoped = await context.db.all(statements[0]!);
    const proof = await context.db.all(statements[1]!);
    assert.ok(proof.every((row) => Number(row.display_value_matches) === 0));
    assert.equal(Number(proof.find((row) => row.metric === 'packages')?.forbidden_cross_source_value), 54);
    assert.equal(String(proof.find((row) => row.metric === 'tonnes')?.forbidden_cross_source_value), '16.3900');
    console.log(`B1A2_SQL ${JSON.stringify({ scoped, proof })}`);
  } finally {
    await context.dispose();
  }
});

test('ERP 库存查询只在诊断日志提示未归属行数，不增加响应字段或重复刷日志', async (t) => {
  const context = await numberingFixture();
  const warning = t.mock.method(logger, 'warn', () => undefined);
  try {
    await seedSourceEvidence(context.db);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await context.web.get('/api/v1/stock/by-source?source=erp-product').expect(200);
      assert.deepEqual(Object.keys(response.body.data).sort(), ['items', 'source', 'subtotal']);
      assert.equal(response.body.data.items.length, 3);
    }
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(warning.mock.calls[0]?.arguments[0], {
      event: 'stock.unclassified_detected',
      stockRows: 2,
      inventorySource: 'erp-product',
    });
    console.log('ERP_INVENTORY_DIAGNOSTIC unclassified_rows=2; warning_calls=1; extra_response_fields=0');
  } finally {
    await context.dispose();
  }
});
