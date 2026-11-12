import { expect } from '@playwright/test';
import { detailSchema, shipmentListSchema } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase, inventoryCell, post } from './inventory-helpers';

test('B5c-1 分三次发货、短关与整单撤销；现有详情正确显示新状态', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db);
    await db.run("UPDATE stock SET packages=200,weight_tonnes='60.0000' WHERE product_code=?", [cell.productCode]);
    const created = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '分批测试',
      lines: [{ productCode: cell.productCode, plannedPackages: 100, plannedWeightGrams: 30000000 }],
    });
    expect(created.status()).toBe(200);
    let order = detailSchema.parse((await created.json()).data);
    for (const packages of [40, 30, 20]) {
      const response = await post(page, `/outbound/${order.id}/shipments`, {
        revision: order.revision,
        digest: order.digest,
        lines: [{ lineId: order.lines[0]!.id, actualPackages: packages, actualWeightGrams: packages * 300000 }],
      });
      expect(response.status()).toBe(200);
      order = detailSchema.parse((await response.json()).data);
      expect(order.status).toBe('partially_shipped');
    }
    await page.goto(`/outbound/${order.id}`);
    await expect(page.getByText('部分发货', { exact: true }).first()).toBeVisible();
    const rejected = await post(page, `/outbound/${order.id}/complete`, {
      revision: order.revision,
      digest: order.digest,
    });
    expect(rejected.status()).toBe(422);
    const closed = await post(page, `/outbound/${order.id}/short-close`, {
      revision: order.revision,
      digest: order.digest,
      reason: '剩余不发',
    });
    expect(closed.status()).toBe(200);
    await page.reload();
    await expect(page.getByText('已短关', { exact: true }).first()).toBeVisible();
    const records = shipmentListSchema.parse(
      (await (await page.request.get(`/api/v1/outbound/${order.id}/shipments`)).json()).data,
    );
    expect(records.items.map((r) => r.lines[0]?.packages)).toEqual([40, 30, 20]);
    expect(records.shortClosure?.packages).toBe(10);
    expect(records.shortClosure?.weightGrams).toBe(3000000);
    const preview = (await (await page.request.get(`/api/v1/outbound/${order.id}/lifecycle`)).json()).data;
    expect(preview.allowed).toBe(true);
    expect(
      (
        await post(page, `/outbound/${order.id}/reverse`, { expectedToken: preview.token, reason: '整单撤销测试' })
      ).status(),
    ).toBe(200);
    expect(await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [cell.productCode])).toEqual({
      packages: 200,
      weight_tonnes: '60.0000',
    });
    console.log(
      'B5C1_E2E shipments=40/30/20 actual=90 short_closed=10 complete_with_remaining=422 reversed=90 stock_restored=true',
    );
  } finally {
    await db.close();
  }
});
