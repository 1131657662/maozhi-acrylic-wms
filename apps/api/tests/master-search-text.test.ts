import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backfillSearchText } from '../src/features/master-data/search-text-backfill.ts';
import { listMasterItems } from '../src/features/master-data/read.ts';
import { createMasterItem, updateMasterItem } from '../src/features/master-data/service.ts';
import { createVehicle, listVehicles, updateVehicle } from '../src/features/master-data/vehicles.ts';
import { migrateDown } from '../src/db/migrate.ts';
import { actor, fixture } from './fixture.ts';
import { numberingFixture } from './numbering-fixture.ts';

test('主数据检索支持拼音全拼、首字母、型号及旧 keyword 参数', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    const product = await createMasterItem(db, 'products', { code: 'PINYIN-1', name: '腈纶', model: '短纤 3D' }, actor);
    assert.ok(
      (await listMasterItems(db, 'products', { q: 'jinglun' })).items.some((item) => item.code === product.code),
    );
    assert.ok((await listMasterItems(db, 'products', { q: 'jl' })).items.some((item) => item.code === product.code));
    assert.ok((await listMasterItems(db, 'products', { q: '3D' })).items.some((item) => item.code === product.code));
    assert.ok(
      (await listMasterItems(db, 'products', { keyword: 'PINYIN-1' })).items.some((item) => item.code === product.code),
    );
    assert.equal((await listMasterItems(db, 'products', { q: 'absent', keyword: 'PINYIN-1' })).total, 0);
    const api = await web.get('/api/v1/master/products?q=jl').expect(200);
    assert.ok(api.body.data.items.some((item: { code: string }) => item.code === product.code));
    const oldApi = await web.get('/api/v1/master/products?keyword=PINYIN-1').expect(200);
    assert.ok(oldApi.body.data.items.some((item: { code: string }) => item.code === product.code));
  } finally {
    await dispose();
  }
});

test('往来单位拼音检索、停用候选过滤及修改同步', async () => {
  const { db, dispose } = await fixture();
  try {
    const customer = await createMasterItem(db, 'customers', { name: '宁波中纤' }, actor);
    await db.run('UPDATE master_customers SET legacy_code=? WHERE code=?', ['OLD-CUST', customer.code]);
    await db.run('UPDATE master_customers SET search_text=NULL WHERE code=?', [customer.code]);
    assert.equal((await backfillSearchText(db)).customers, 1);
    assert.ok(
      (await listMasterItems(db, 'customers', { q: 'ningbozhongxian' })).items.some(
        (item) => item.code === customer.code,
      ),
    );
    assert.ok(
      (await listMasterItems(db, 'customers', { q: 'nbzx' })).items.some((item) => item.code === customer.code),
    );
    assert.ok(
      (await listMasterItems(db, 'customers', { q: 'old-cust' })).items.some((item) => item.code === customer.code),
    );
    await updateMasterItem(db, 'customers', customer.code, { name: '浙江新客户' }, actor);
    assert.equal((await listMasterItems(db, 'customers', { q: 'nbzx' })).total, 0);
    assert.ok(
      (await listMasterItems(db, 'customers', { q: 'zjxkh' })).items.some((item) => item.code === customer.code),
    );
    await updateMasterItem(db, 'customers', customer.code, { active: false }, actor);
    assert.equal((await listMasterItems(db, 'customers', { q: 'zjxkh', status: 'active' })).total, 0);
  } finally {
    await dispose();
  }
});

test('商品候选继续排除无库存资格商品', async () => {
  const { db, dispose } = await fixture();
  try {
    const product = await createMasterItem(db, 'products', { code: 'NO-STOCK', name: '检索资格腈纶' }, actor);
    await db.run('UPDATE master_products SET inventory_eligible=0 WHERE code=?', [product.code]);
    assert.equal(
      (await listMasterItems(db, 'products', { q: 'jszgjl', status: 'active', scope: 'inventory' })).total,
      0,
    );
    assert.ok(
      (await listMasterItems(db, 'products', { q: 'jszgjl' })).items.some((item) => item.code === product.code),
    );
  } finally {
    await dispose();
  }
});

test('车辆新增和修改保留归一化车牌搜索且接受 q 别名', async () => {
  const { db, dispose } = await fixture();
  try {
    const vehicle = await createVehicle(db, { plate: '苏 F-80807' }, actor);
    await updateVehicle(db, vehicle.id, { driver: '测试司机' }, actor);
    assert.ok((await listVehicles(db, { q: '苏f 80807' })).items.some((item) => item.id === vehicle.id));
    assert.ok((await listVehicles(db, { keyword: '80807' })).items.some((item) => item.id === vehicle.id));
  } finally {
    await dispose();
  }
});

test('NULL 回填可重复执行且有数据时拒绝回退 022', async () => {
  const { db, dispose } = await fixture();
  try {
    await db.run("UPDATE master_products SET search_text=NULL WHERE code='ACR-032'");
    const first = await backfillSearchText(db);
    const second = await backfillSearchText(db);
    assert.equal(first.products, 1);
    assert.deepEqual(second, { products: 0, customers: 0, suppliers: 0, vehicles: 0 });
    await assert.rejects(migrateDown(db), /master_.*search_text 已有数据/);
    for (const table of ['master_products', 'master_customers', 'master_suppliers', 'master_vehicles'])
      assert.ok(await db.get(`SHOW COLUMNS FROM ${table} LIKE 'search_text'`));
  } finally {
    await dispose();
  }
});
