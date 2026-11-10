import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { voidStocktake } from '../src/features/stocktake/void.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';
import { newReceipt } from './numbering-fixture.ts';
import { adjustment, frozenOrder } from './inventory-fixture.ts';
import { prepared, commandFor, businessFingerprint } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { AppError } from '../src/shared/errors.ts';
import { login } from '../src/features/auth/service.ts';

test('B3a 仓库暂停所有库存写入但不阻断PDA补传冻结；作废保留事实恢复确认', async () => {
  const { db, dispose } = await fixture();
  try {
    const original = await prepared(db, 'inbound');
    const reverse = await commandFor(db, original);
    const pending = await createInbound(db, newReceipt(), randomUUID(), actor);
    const take = await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const frozen = await frozenOrder(db);
    const before = await businessFingerprint(db);
    const blocked = [
      () => confirmInbound(db, pending.id, randomUUID(), actor),
      () => confirmOutbound(db, { planId: frozen.id, expected: frozen, key: randomUUID(), actor }),
      () => adjustStock(db, adjustment(), randomUUID(), actor),
      () => executeLifecycle(db, reverse),
    ];
    for (const run of blocked)
      await assert.rejects(
        run(),
        (e) => e instanceof AppError && e.code === 'WAREHOUSE_STOCKTAKE_PAUSED' && e.status === 409,
      );
    assert.deepEqual(await businessFingerprint(db), before);
    const stock = await db.all('SELECT * FROM stock'),
      journal = await db.all('SELECT * FROM stock_journal');
    const command = {
      id: take.id,
      input: { expectedRevision: 0, reason: '结束现场盘点，重新安排' },
      key: randomUUID(),
      actor,
    };
    const result = await voidStocktake(db, command);
    assert.equal(result.status, 'voided');
    assert.deepEqual(await voidStocktake(db, command), result);
    assert.deepEqual(await db.all('SELECT * FROM stock'), stock);
    assert.deepEqual(await db.all('SELECT * FROM stock_journal'), journal);
    assert.equal((await confirmInbound(db, pending.id, randomUUID(), actor)).status, 'confirmed');
    console.log(
      'B3A_WINDOW inbound=409 outbound=409 adjustment=409 reverse=409 rejected_database_unchanged=true pda_upload_freeze=success void_stock_journal_unchanged=true after_void_confirm=200',
    );
  } finally {
    await dispose();
  }
});
test('B3a 他仓可确认、指定零库存商品可实盘、PDA/小程序不得操作盘点', async () => {
  const { db, api, dispose } = await fixture();
  try {
    await db.run(
      "INSERT INTO master_warehouses(code,name,created_at,updated_at) VALUES('OTHER','另一仓库',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
    );
    await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const receipt = await createInbound(db, { ...newReceipt(), warehouseCode: 'OTHER' }, randomUUID(), actor);
    await confirmInbound(db, receipt.id, randomUUID(), actor);
    await db.run(
      "INSERT INTO master_products(code,name,source_kind,created_at,updated_at,origin_kind,inventory_eligible) VALUES('ZERO','零库存范围','erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)",
    );
    const take = await createStocktake(db, { warehouseCode: 'OTHER', productCodes: ['ZERO'] }, randomUUID(), actor);
    assert.equal(take.snapshotPackages, 0);
    assert.equal(take.snapshotWeightGrams, 0);
    await saveReading(db, {
      id: take.id,
      productCode: 'ZERO',
      input: { expectedRevision: 0, actual: { packages: 0, weightGrams: 0 } },
      key: randomUUID(),
      actor,
    });
    for (const channel of ['pda', 'miniapp'] as const) {
      const session = await login(db, { username: 'owner', password: 'test-only-password', channel }, actor);
      for (const path of ['/stocktakes', `/stocktakes/${take.id}/void`, `/stocktakes/${take.id}/post`]) {
        const response = await api.post(`/api/v1${path}`).auth(session.token, { type: 'bearer' }).send({});
        assert.equal(response.status, 403);
      }
    }
    console.log('B3A_ISOLATION other_warehouse_confirm=200 zero_snapshot=0/0 mobile_channels=403');
  } finally {
    await dispose();
  }
});
