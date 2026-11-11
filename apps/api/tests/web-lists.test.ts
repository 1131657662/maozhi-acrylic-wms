import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { webInboundListSchema, webOutboundListSchema, webStockListSchema, webAuditListSchema } from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';
import { seedListEvidence } from '../../../scripts/e2e-list-fixtures.ts';
import { seedSourceEvidence } from '../../../scripts/e2e-source-fixtures.ts';
import { inventorySnapshot, frozenOrder } from './inventory-fixture.ts';

test('Web 列表多条件/日期边界/稳定分页，软删明细不进入包数与重量', async () => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    const read = async (page: number) =>
      webInboundListSchema.parse(
        (
          await context.web.get('/api/v1/web/lists/inbound').query({
            keyword: 'WL-RK-',
            supplier: '合成供应商',
            warehouse: 'DEMO-WH',
            postingState: 'pending',
            from: '2026-11-02T00:00:00+08:00',
            to: '2026-11-02T23:59:59.999+08:00',
            pageSize: 200,
            page,
          })
        ).body.data,
      );
    const first = await read(1);
    const second = await read(2);
    const defaultPage = await context.web.get('/api/v1/web/lists/inbound').query({ keyword: 'WL-RK-' }).expect(200);
    assert.equal(defaultPage.body.data.pageSize, 50);
    assert.equal(first.total, 240);
    assert.equal(first.items.length, 200);
    assert.equal(second.items.length, 40);
    assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 240);
    assert.ok(first.items.every((row) => row.packages === 2 && row.weightGrams === 600000));
    assert.equal(first.items[0]?.id, 'WL-R000239');
    const unknown = await context.web.get('/api/v1/web/lists/inbound').query({ status: 'legacy-code' }).expect(200);
    assert.equal(unknown.body.data.total, 79);
    const missing = await context.web.get('/api/v1/web/lists/inbound').query({ statusMissing: 'true' }).expect(200);
    assert.equal(missing.body.data.total, 1);
    console.log('B1B1_QUERY inbound=240 pages=200+40 unique=240 soft_deleted_lines_excluded=true status_raw=79 null=1');
  } finally {
    await context.dispose();
  }
});

test('出库摘要与旧详情一致，多明细与多事实不放大汇总', async () => {
  const context = await numberingFixture();
  try {
    await frozenOrder(context.db);
    await context.db.run(
      "INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes) VALUES('extra','DEMO-001','ACR-032','extra',1,'0.1000')",
    );
    const before = await inventorySnapshot(context.db);
    const response = await context.web
      .get('/api/v1/web/lists/outbound')
      .query({ keyword: 'DEMO-OUT-20261107-001' })
      .expect(200);
    const row = webOutboundListSchema.parse(response.body.data).items[0]!;
    const legacy = (await context.web.get('/api/v1/outbound/DEMO-001').expect(200)).body.data;
    for (const key of ['plannedPackages', 'plannedWeightGrams', 'actualPackages', 'actualWeightGrams'] as const)
      assert.equal(row[key], legacy[key]);
    assert.equal(row.actualPackages, 2);
    assert.equal(row.actualWeightGrams, 600000);
    assert.equal(row.plannedPackages, 3);
    assert.equal(row.plannedWeightGrams, 700000);
    assert.deepEqual(await inventorySnapshot(context.db), before);
    console.log('B1B1_AGGREGATION planned=3/0.7000 actual=2/0.6000 fanout=0 business_writes=0');
  } finally {
    await context.dispose();
  }
});

test('商品反查按主单分页，支持任一/全部与重复编码，命中汇总保持一致', async () => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    const inboundAny = webInboundListSchema.parse(
      (
        await context.web
          .get('/api/v1/web/lists/inbound')
          .query({ productCodes: 'WL-P000001,WL-P000001', productMode: 'any', pageSize: 20 })
          .expect(200)
      ).body.data,
    );
    assert.equal(inboundAny.total, 1);
    assert.equal(inboundAny.items.length, 1);
    const inboundRow = inboundAny.items[0]!;
    assert.equal(inboundRow.matchedLineCount, inboundRow.matchedLines?.length);
    assert.equal(inboundRow.matchedLineCount, 2);
    assert.equal(
      inboundRow.matchedLines?.reduce((sum, line) => sum + line.packages, 0),
      2,
    );
    assert.equal(
      inboundRow.matchedLines?.reduce((sum, line) => sum + line.weightGrams, 0),
      600000,
    );
    assert.deepEqual(inboundAny.matchedTotals, { documentCount: 1, lineCount: 2, packages: 2, weightGrams: 600000 });

    await context.db.run(
      "INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_del_flag) VALUES('reverse-all','DEMO-001','REVERSE-ALL','反查商品',2,'0.5000',0)",
    );
    const outboundAll = webOutboundListSchema.parse(
      (
        await context.web
          .get('/api/v1/web/lists/outbound')
          .query({ productCodes: 'ACR-032,REVERSE-ALL,ACR-032', productMode: 'all', pageSize: 20 })
          .expect(200)
      ).body.data,
    );
    assert.equal(outboundAll.total, 1);
    const outboundRow = outboundAll.items[0]!;
    assert.equal(outboundRow.id, 'DEMO-001');
    assert.equal(outboundRow.matchedLineCount, outboundRow.matchedLines?.length);
    assert.equal(outboundRow.matchedLineCount, 2);
    assert.equal(
      outboundRow.matchedLines?.reduce((sum, line) => sum + line.packages, 0),
      4,
    );
    assert.equal(
      outboundRow.matchedLines?.reduce((sum, line) => sum + line.weightGrams, 0),
      1100000,
    );
    assert.deepEqual(outboundAll.matchedTotals, { documentCount: 1, lineCount: 2, packages: 4, weightGrams: 1100000 });

    const pageCodes = Array.from({ length: 21 }, (_, index) => `WL-P${String(index).padStart(6, '0')}`).join(',');
    const page = webInboundListSchema.parse(
      (
        await context.web
          .get('/api/v1/web/lists/inbound')
          .query({ productCodes: pageCodes, page: 2, pageSize: 20 })
          .expect(200)
      ).body.data,
    );
    assert.equal(page.total, 21);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.matchedLineCount, 2);
    assert.ok(page.items[0]!.matchedLines?.every((line) => pageCodes.includes(line.productCode)));
    assert.deepEqual(page.matchedTotals, { documentCount: 21, lineCount: 42, packages: 42, weightGrams: 12600000 });
    const noLookup = webInboundListSchema.parse(
      (await context.web.get('/api/v1/web/lists/inbound').query({ pageSize: 20 }).expect(200)).body.data,
    );
    assert.equal('matchedLineCount' in noLookup.items[0]!, false);
    assert.equal('matchedLines' in noLookup.items[0]!, false);
    assert.equal('matchedTotals' in noLookup, false);
    await context.web.get('/api/v1/web/lists/inbound').query({ productMode: 'invalid' }).expect(422);
    console.log(
      'B6B_STEP2 inbound_any=1/2/2/0.6000 outbound_all=1/2/4/1.1000 page_scope=current no_lookup_fields=omitted invalid_mode=422',
    );
  } finally {
    await context.dispose();
  }
});

test('ERP 分页小计与筛选范围一致，拒绝跨来源/总计参数及混源响应', async () => {
  const context = await numberingFixture();
  try {
    await seedSourceEvidence(context.db);
    const response = await context.web.get('/api/v1/web/lists/stock').query({ source: 'erp-product' }).expect(200);
    const result = webStockListSchema.parse(response.body.data);
    assert.equal(result.total, 3);
    assert.deepEqual(result.subtotal, { packages: 24, weightGrams: 7246000 });
    const filtered = webStockListSchema.parse(
      (
        await context.web
          .get('/api/v1/web/lists/stock')
          .query({ source: 'erp-product', product: result.items[0]!.productCode })
          .expect(200)
      ).body.data,
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.subtotal.packages, filtered.items[0]!.packages);
    for (const query of [
      '',
      '?source=all',
      '?source=sku-spec',
      '?source=erp-product&source=sku-spec',
      '?source=erp-product&total=true',
    ])
      await context.web.get('/api/v1/web/lists/stock' + query).expect(422);
    assert.equal(webStockListSchema.safeParse({ ...result, source: 'sku-spec' }).success, false);
    console.log('B1B1_STOCK erp_rows=3 subtotal=24/7.2460 filtered_rows=1 source_guards=5x422');
  } finally {
    await context.dispose();
  }
});

test('日志不再截断 100 条，列表不传大 JSON，详情按 ID 查询', async () => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    const response = await context.web
      .get('/api/v1/web/lists/audit')
      .query({ action: 'list.fixture', page: 2, pageSize: 200 })
      .expect(200);
    const result = webAuditListSchema.parse(response.body.data);
    assert.equal(result.total, 240);
    assert.equal(result.items.length, 40);
    assert.ok(result.items.every((row) => !('beforeJson' in row)));
    const detail = await context.web.get('/api/v1/web/lists/audit/' + result.items[0]!.id).expect(200);
    assert.equal('beforeJson' in detail.body.data, false);
    const raw = await context.web.get('/api/v1/web/lists/audit/' + result.items[0]!.id + '/raw').expect(200);
    assert.deepEqual(JSON.parse(raw.body.data.items[0].record.before_json), { packages: 1 });
    await context.web.get('/api/v1/web/lists/audit/999999999').expect(404);
    console.log('B1B1_AUDIT total=240 page2=40 before_after_detail=matched');
  } finally {
    await context.dispose();
  }
});

test('Web 查询严格验证字段，匿名与 PDA/小程序无权访问，旧契约保持可用', async () => {
  const context = await numberingFixture();
  try {
    for (const query of [
      { pageSize: 201 },
      { sortBy: 'id; DROP TABLE stock' },
      { unexpected: '1' },
      { from: '2026-11-03T00:00:00Z', to: '2026-11-02T00:00:00Z' },
    ])
      await context.web.get('/api/v1/web/lists/inbound').query(query).expect(422);
    await request(context.app).get('/api/v1/web/lists/audit').expect(401);
    const before = (await context.web.get('/api/v1/stock')).body.data;
    for (const channel of ['pda', 'miniapp']) {
      const login = await request(context.app)
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      const auth = 'Bearer ' + login.body.data.token;
      for (const path of ['inbound', 'outbound', 'stock?source=erp-product', 'audit', 'inbound/statuses'])
        await request(context.app)
          .get('/api/v1/web/lists/' + path)
          .set('Authorization', auth)
          .expect(403);
      assert.deepEqual(
        (await request(context.app).get('/api/v1/stock').set('Authorization', auth).expect(200)).body.data,
        before,
      );
      await request(context.app).get('/api/v1/scan/plans').set('Authorization', auth).expect(200);
    }
    console.log('B1B1_AUTH invalid=4x422 anonymous=401 mobile=10x403 legacy_contracts=unchanged');
  } finally {
    await context.dispose();
  }
});
