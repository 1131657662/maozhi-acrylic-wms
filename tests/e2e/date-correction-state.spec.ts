import { expect } from '@playwright/test';
import { test } from './list-test';
import { post } from './inventory-helpers';
import { openDateCorrection } from './date-correction-helpers';
import { shipmentOrder, inputShipment, sendShipment } from './shipment-ui-helpers';

test('B5d-1 入库同页入账后显示日期入口，撤销后隐藏', async ({ page }) => {
  const response = await post(page, '/inbound', {
    supplierCode: 'DEMO-SUPPLIER',
    warehouseCode: 'DEMO-WH',
    lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 300000 }],
  });
  expect(response.status()).toBe(200);
  const receipt = (await response.json()).data;
  await page.goto(`/inbound/${receipt.id}`);
  const panel = page.getByTestId('date-correction-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /^更\s*多$/ })).toHaveCount(0);
  await page.getByRole('button', { name: '核对并确认入库', exact: true }).click();
  await page.getByRole('button', { name: '确认入账', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openDateCorrection(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^取\s*消$/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '核对撤销误确认', exact: true }).click();
  await page.getByLabel('误确认原因', { exact: true }).fill('合成入账入口复测');
  await page.getByRole('button', { name: '确认撤销入账', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^更\s*多$/ })).toHaveCount(0);
});

test('B5d-1 出库同页首次发货后立即显示日期更正入口', async ({ page }) => {
  const order = await shipmentOrder(page);
  await page.goto(`/outbound/${order.id}`);
  const panel = page.getByTestId('date-correction-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /^更\s*多$/ })).toHaveCount(0);
  await inputShipment(page, 40, '12');
  await sendShipment(page);
  await openDateCorrection(page);
});
