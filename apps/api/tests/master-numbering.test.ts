import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';
import { createMasterItem } from '../src/features/master-data/service.ts';
import { actor } from './fixture.ts';

test('自动客户编码顺序、删除不回收、并发唯一、幂等重放与改名', async () => {
  const c = await numberingFixture();
  try {
    const post = (name: string, key = randomUUID()) =>
      c.web
        .post('/api/v1/master/customers')
        .set('Origin', origin)
        .set('Idempotency-Key', key)
        .send({ name })
        .expect(200);
    const first = (await post('编号客户甲')).body.data;
    const second = (await post('编号客户乙')).body.data;
    // Deletion is fixture setup only; no new deletion API is introduced.
    await c.db.run('DELETE FROM master_customers WHERE code=?', [second.code]);
    const third = (await post('编号客户丙')).body.data;
    assert.deepEqual([first.code, second.code, third.code], ['C00001', 'C00002', 'C00003']);
    const concurrent = await Promise.all(Array.from({ length: 5 }, (_, i) => post(`并发客户${i}`)));
    const codes: string[] = concurrent.map((r) => r.body.data.code).sort();
    assert.deepEqual(codes, ['C00004', 'C00005', 'C00006', 'C00007', 'C00008']);
    const key = randomUUID();
    const replayed = await Promise.all(Array.from({ length: 5 }, () => post('幂等客户', key)));
    assert.equal(new Set(replayed.map((r) => r.body.data.code)).size, 1);
    assert.equal(replayed[0]!.body.data.code, 'C00009');
    await c.web
      .post('/api/v1/master/customers')
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({ name: '不同正文' })
      .expect(409);
    const changed = await c.web
      .patch(`/api/v1/master/customers/${first.code}`)
      .set('Origin', origin)
      .send({ name: '改名成功' })
      .expect(200);
    const before = await tableFingerprints(c.db);
    await c.web
      .patch(`/api/v1/master/customers/${first.code}`)
      .set('Origin', origin)
      .send({ name: '非法改码', code: 'C99999' })
      .expect(422);
    await c.web
      .post('/api/v1/master/customers')
      .set('Origin', origin)
      .send({ name: '非法指定编码', code: 'C99999' })
      .expect(422);
    assert.deepEqual(await tableFingerprints(c.db), before);
    assert.equal(changed.body.data.code, first.code);
    assert.equal(changed.body.data.name, '改名成功');
    console.log(
      'B6A_NUM_MASTER',
      JSON.stringify({
        sequential: [first.code, second.code, third.code],
        deleted: second.code,
        concurrent: codes,
        duplicates: codes.length - new Set(codes).size,
        replayCode: 'C00009',
        replayRequests: 5,
        rename: changed.body.data.name,
        editCodeStatus: 422,
        createWithCodeStatus: 422,
      }),
    );
  } finally {
    await c.dispose();
  }
});

test('供应商/仓库编码与碰撞重试，商品仍手工，所有容量耗尽均回滚', async () => {
  const c = await numberingFixture();
  try {
    const supplier = await createMasterItem(c.db, 'suppliers', { name: '自动供应商' }, actor);
    const warehouse = await createMasterItem(c.db, 'warehouses', { name: '自动仓库' }, actor);
    assert.equal(supplier.code, 'S0001');
    assert.equal(warehouse.code, 'W01');
    await c.db.run(
      "INSERT INTO master_customers(code,name,active,created_at,updated_at) VALUES('C00001','已占号',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
    );
    const collision = await createMasterItem(c.db, 'customers', { name: '碰撞后客户' }, actor);
    assert.equal(collision.code, 'C00002');
    const product = await createMasterItem(c.db, 'products', { code: 'MANUAL-130', name: '手工商品' }, actor);
    assert.equal(product.code, 'MANUAL-130');
    for (const [catalog, prefix, last] of [
      ['customers', 'C', 99999],
      ['suppliers', 'S', 9999],
      ['warehouses', 'W', 99],
    ] as const) {
      await c.db.run('UPDATE master_code_counters SET `last_value`=? WHERE prefix=?', [last, prefix]);
      const before = await tableFingerprints(c.db);
      const failed = await c.web
        .post(`/api/v1/master/${catalog}`)
        .set('Origin', origin)
        .send({ name: '容量越界' })
        .expect(422);
      assert.equal(failed.body.message, '编号容量已用尽，需计划重编');
      assert.deepEqual(await tableFingerprints(c.db), before);
      console.log(
        'B6A_NUM_CAPACITY',
        JSON.stringify({ catalog, last, status: failed.status, message: failed.body.message, databaseUnchanged: true }),
      );
    }
    console.log(
      'B6A_NUM_OTHER_CODES',
      JSON.stringify({
        supplier: supplier.code,
        warehouse: warehouse.code,
        collisionNext: collision.code,
        product: product.code,
      }),
    );
  } finally {
    await c.dispose();
  }
});

test('发号后审计失败整个事务回滚，重试不跳号', async () => {
  const c = await numberingFixture();
  try {
    const transaction = c.db.transaction.bind(c.db);
    const before = await tableFingerprints(c.db);
    c.db.transaction = (work) =>
      transaction(async (tx) => {
        const run = tx.run.bind(tx);
        tx.run = (sql, values) => {
          if (/INSERT INTO operation_log/i.test(sql)) throw new Error('injected-audit-failure');
          return run(sql, values);
        };
        return work(tx);
      });
    await assert.rejects(createMasterItem(c.db, 'customers', { name: '原子创建' }, actor), /injected-audit-failure/);
    c.db.transaction = transaction;
    assert.deepEqual(await tableFingerprints(c.db), before);
    assert.equal((await createMasterItem(c.db, 'customers', { name: '原子创建' }, actor)).code, 'C00001');
  } finally {
    await c.dispose();
  }
});
