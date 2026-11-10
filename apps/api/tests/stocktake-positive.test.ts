import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { postCommand } from './stocktake-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B3a 零库存盘盈独立包重入账；软删库存不被隐式覆盖', async () => {
  const { db, dispose } = await fixture();
  try {
    await db.run(
      "INSERT INTO master_products(code,name,source_kind,created_at,updated_at,origin_kind,inventory_eligible) VALUES('COUNT-ZERO','合成零库存商品','erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)",
    );
    const take = await createStocktake(
      db,
      { warehouseCode: 'DEMO-WH', productCodes: ['COUNT-ZERO'] },
      randomUUID(),
      actor,
    );
    await saveReading(db, {
      id: take.id,
      productCode: 'COUNT-ZERO',
      input: { expectedRevision: 0, actual: { packages: 3, weightGrams: 721300 } },
      key: randomUUID(),
      actor,
    });
    const command = postCommand(await stocktakePreview(db, take.id));
    await db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag) VALUES('DEMO-WH','COUNT-ZERO',0,0,1)",
    );
    const before = await businessFingerprint(db);
    await assert.rejects(postStocktake(db, command), /禁止覆盖/);
    assert.deepEqual(await businessFingerprint(db), before);
    // Synthetic fixture only: remove the injected tombstone, never historical user data.
    await db.run("DELETE FROM stock WHERE product_code='COUNT-ZERO'");
    await postStocktake(db, command);
    const row = await db.get(
      "SELECT packages_before,packages_after,packages_delta,tonnes_before,tonnes_after,tonnes_delta FROM stock_journal WHERE product_code='COUNT-ZERO'",
    );
    assert.deepEqual(row, {
      packages_before: 0,
      packages_after: 3,
      packages_delta: 3,
      tonnes_before: '0.0000',
      tonnes_after: '0.7213',
      tonnes_delta: '0.7213',
    });
    console.log(
      'B3A_POSITIVE zero_snapshot=true actual=3/0.7213 delta=3/0.7213 soft_deleted_collision=409 unchanged=true',
    );
  } finally {
    await dispose();
  }
});
