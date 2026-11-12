import { expect } from '@playwright/test';
import { detailSchema, shipmentListSchema } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase, inventoryCell, post } from './inventory-helpers';

test('B5c-2 发货行更正后，详情实发、差异与列表显示有效量', async ({ page }) => {
  test.setTimeout(90000);
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db);
    await db.run("UPDATE stock SET packages=200,weight_tonnes='60.0000' WHERE product_code=?", [cell.productCode]);
    const created = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '更正测试',
      lines: [{ productCode: cell.productCode, plannedPackages: 100, plannedWeightGrams: 30000000 }],
    });
    expect(created.status()).toBe(200);
    let order = detailSchema.parse((await created.json()).data);
    for (const packages of [40, 60]) {
      const response = await post(page, `/outbound/${order.id}/shipments`, {
        revision: order.revision,
        digest: order.digest,
        lines: [{ lineId: order.lines[0]!.id, actualPackages: packages, actualWeightGrams: packages * 300000 }],
      });
      expect(response.status()).toBe(200);
      order = detailSchema.parse((await response.json()).data);
    }
    const readShipments = async () =>
      shipmentListSchema.parse((await (await page.request.get(`/api/v1/outbound/${order.id}/shipments`)).json()).data);
    const second = (await readShipments()).items[1]!.lines[0]!;
    const input = {
      expectedCorrectionRevision: 0,
      previousCorrectionId: null,
      reason: '第二车数量更正',
      lines: [{ originalLineId: second.lineId, packages: 50, weightGrams: 15000000 }],
    };
    expect((await post(page, `/outbound/${order.id}/corrections`, input)).status()).toBe(422);
    await page.goto(`/outbound/${order.id}`);
    await page.getByTestId('document-bottom-actions').getByRole('button', { name: '数量更正' }).click();
    const drawer = page.getByRole('dialog', { name: /数量更正/ });
    await drawer.getByLabel('选择发货批次').click();
    await page
      .locator('.ant-select-item-option-content')
      .filter({ hasText: /第 2 次发货/ })
      .click();
    await drawer.getByLabel(`${cell.productCode} 更正后包数`).fill('50');
    await drawer.getByLabel(`${cell.productCode} 更正后吨数`).fill('15');
    await drawer.getByLabel('更正原因', { exact: true }).fill('第二车数量更正');
    await expect(drawer.getByText('本次差额：-10 包 / -3.0000 吨')).toBeVisible();
    await page.screenshot({ path: '.local/evidence/b5c-2-correction-drawer-1440.png' });
    await drawer.getByRole('button', { name: '核对并提交' }).click();
    await page.getByRole('button', { name: '确认更正并入账' }).click();
    await expect(drawer).toHaveCount(0);
    const records = await readShipments();
    expect(records.items.map((sh) => sh.lines[0]!.effectivePackages)).toEqual([40, 50]);
    expect(records.remainingPackages).toBe(10);
    await page.goto(`/outbound/${order.id}`);
    await expect(page.getByTestId('shipment-metrics')).toContainText('100 包 / 30.0000 吨');
    await expect(page.getByTestId('shipment-metrics')).toContainText('90 包 / 27.0000 吨');
    await expect(page.getByTestId('actual-lines')).toContainText('10 包 / 3.0000 吨');
    await expect(page.getByTestId('correction-summary')).toContainText('90 包 / 27.0000 吨');
    await expect(page.getByTestId('correction-summary')).toContainText('第 2 次发货');
    await page.screenshot({ path: '.local/evidence/b5c-2-correction-detail-1440.png' });
    await page.goto(`/?keyword=${encodeURIComponent(order.orderNo)}`);
    const response = await page.request.get(`/api/v1/web/lists/outbound?keyword=${encodeURIComponent(order.orderNo)}`);
    expect(response.status()).toBe(200);
    const item = (await response.json()).data.items[0];
    expect(item.actualPackages).toBe(90);
    expect(item.actualWeightGrams).toBe(27000000);
    await expect(page.getByTestId('list-results').getByRole('row').filter({ hasText: order.orderNo })).toBeVisible();
    console.log('B5C2_E2E original=40/60 effective=40/50 detail=90/27.0000t difference=-10/-3.0000t list=90/27.0000t');
  } finally {
    await db.close();
  }
});
