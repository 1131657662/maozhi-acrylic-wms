import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { detailSchema, tonnes } from '@wms/contracts';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { fact } from './fixture.ts';
import { hash } from '../src/shared/hash.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B4a R1 下载→离线扫码→Web修改→原UUID/正文补传；明细改动409且无副作用', async () => {
  const f = await numberingFixture();
  try {
    const created = (
      await f.web
        .post('/api/v1/outbound')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send(newPlan())
        .expect(200)
    ).body.data;
    const token = (
      await f.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
        .expect(200)
    ).body.data.token;
    const downloaded = detailSchema.parse(
      (await f.api.get(`/api/v1/scan/plans/${created.id}`).auth(token, { type: 'bearer' }).expect(200)).body.data,
    );
    const offline = JSON.stringify({
      schemaVersion: 2,
      fact: fact(),
      context: { outboundLineId: downloaded.lines[0]!.id, sourceSpec: '合成规格', resolvedAt: null },
    });
    const edit = (plan: unknown, current = downloaded, key = randomUUID()) =>
      f.web
        .patch(`/api/v1/outbound/${created.id}`)
        .set('Origin', origin)
        .set('Idempotency-Key', key)
        .send({ revision: current.revision, digest: current.digest, plan });
    const before = await businessFingerprint(f.db);
    for (const lines of [[], [{ ...newPlan().lines[0]!, plannedPackages: 2 }]]) {
      const rejected = await edit({ vehicleNo: '不应生效', lines }).expect(409);
      assert.equal(rejected.body.code, 'PLAN_LINES_IMMUTABLE');
      assert.match(
        rejected.body.message,
        /计划已下发或已有扫码事实，明细不可修改，只能改车号\/备注；如需改明细请作废后重建/,
      );
      console.log('B4A_R1_409', JSON.stringify(rejected.body));
    }
    assert.deepEqual(await businessFingerprint(f.db), before);
    const key = randomUUID(),
      body = { vehicleNo: '离线期间改车号', memo: '保留原行' };
    const edited = detailSchema.parse((await edit(body, downloaded, key).expect(200)).body.data);
    assert.deepEqual(edited.lines, downloaded.lines);
    assert.equal(edited.digest, downloaded.digest);
    assert.deepEqual((await edit(body, downloaded, key).expect(200)).body.data, edited);
    const stale = await edit({ vehicleNo: '过期编辑' }).expect(409);
    assert.equal(stale.body.code, 'STALE_PLAN');
    const upload = () =>
      f.api
        .post(`/api/v1/scan/plans/${created.id}/facts`)
        .auth(token, { type: 'bearer' })
        .set('Content-Type', 'application/json')
        .send(offline);
    const received = detailSchema.parse((await upload().expect(200)).body.data);
    const savedFact = JSON.parse(offline).fact;
    assert.equal(received.lines[0]!.id, downloaded.lines[0]!.id);
    const { planId: _plan, receivedAt: _received, recordedBy: _actor, ...bodyFact } = received.facts[0]!;
    assert.deepEqual(bodyFact, savedFact);
    assert.equal(
      (await f.db.get('SELECT payload_hash FROM scan_facts WHERE id=?', [savedFact.id]))?.payload_hash,
      hash(JSON.stringify({ planId: created.id, fact: savedFact })),
    );
    assert.deepEqual((await upload().expect(200)).body.data, received);
    assert.equal((await edit({ vehicleNo: '补传后改车号' }, received).expect(200)).body.data.facts.length, 1);
    console.log(
      'B4A_R1_SEQUENCE',
      JSON.stringify({
        lineId: received.lines[0]!.id,
        uuid: savedFact.id,
        offlineBody: offline,
        upload: 200,
        repeat: 200,
        lineIdUnchanged: true,
        uuidUnchanged: true,
        bodyUnchanged: true,
      }),
    );
  } finally {
    await f.dispose();
  }
});

test('B4a R2 商品写入口全部关闭；app/SPEC入库出库建单均拒绝且无写入', async () => {
  const f = await numberingFixture();
  try {
    for (const [code, kind] of [
      ['LOCAL-APP', 'app'],
      ['SPEC-ONLY', 'sku-spec'],
    ])
      await f.db.run(
        'INSERT INTO master_products(code,name,source_kind,created_at,updated_at) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',
        [code!, code!, kind!],
      );
    const before = await businessFingerprint(f.db);
    await f.web
      .post('/api/v1/master-data/products')
      .set('Origin', origin)
      .send({ code: 'BLOCKED', name: '不应创建' })
      .expect(403);
    for (const input of [{ name: '不应改名' }, { active: false }, { active: true }]) {
      const response = await f.web
        .patch('/api/v1/master-data/products/ACR-032')
        .set('Origin', origin)
        .send(input)
        .expect(403);
      assert.equal(response.body.code, 'PRODUCT_MASTER_READ_ONLY');
      assert.equal(response.body.message, '商品由 ERP 维护，此处只读');
    }
    for (const code of ['LOCAL-APP', 'SPEC-ONLY'])
      for (const kind of ['inbound', 'outbound']) {
        const input =
          kind === 'inbound'
            ? { ...newReceipt(), lines: [{ ...newReceipt().lines[0]!, productCode: code }] }
            : { ...newPlan(), lines: [{ ...newPlan().lines[0]!, productCode: code }] };
        const response = await f.web
          .post(`/api/v1/${kind}`)
          .set('Origin', origin)
          .set('Idempotency-Key', randomUUID())
          .send(input)
          .expect(409);
        assert.equal(response.body.code, 'PRODUCT_NOT_INVENTORY');
        console.log(
          'B4A_R2_REJECT',
          JSON.stringify({ product: code, kind, httpStatus: response.status, response: response.body }),
        );
      }
    assert.deepEqual(await businessFingerprint(f.db), before);
    const products = (await f.web.get('/api/v1/master-data/products').expect(200)).body.data.items;
    assert.deepEqual(
      products.map((row: { code: string }) => row.code),
      ['ACR-032'],
    );
    for (const code of ['LOCAL-APP', 'SPEC-ONLY']) await f.web.get(`/api/v1/master-data/products/${code}`).expect(404);
  } finally {
    await f.dispose();
  }
});

test('B4a R5 每行1000吨边界输入输出一致，超限不留单据', async () => {
  const f = await numberingFixture();
  try {
    for (const grams of [999999900, 1000000000, 1000000100]) {
      const input = { ...newPlan(), lines: [{ ...newPlan().lines[0]!, plannedWeightGrams: grams }] };
      const response = await f.web
        .post('/api/v1/outbound')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send(input);
      assert.equal(response.status, grams <= 1000000000 ? 200 : 422);
      if (response.status === 200) {
        const result = detailSchema.parse(response.body.data);
        assert.equal(result.lines[0]!.plannedWeightGrams, grams);
        const read = detailSchema.parse((await f.web.get(`/api/v1/outbound/${result.id}`).expect(200)).body.data);
        assert.equal(read.lines[0]!.plannedWeightGrams, grams);
      }
      console.log(
        'B4A_R5_WEIGHT',
        JSON.stringify({
          tonnes: tonnes(grams),
          httpStatus: response.status,
          code: response.body.code,
          returnedGrams: response.body.data?.lines[0]?.plannedWeightGrams ?? null,
        }),
      );
    }
    assert.equal(
      Number((await f.db.get("SELECT COUNT(*) AS n FROM outbound_orders WHERE vehicle_no='NUMBER-TEST'"))?.n),
      2,
    );
  } finally {
    await f.dispose();
  }
});
