import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { inputShipment, shipmentOrder, shipmentRecords } from './shipment-ui-helpers';

test('B5c-3 发货响应丢失，返回核对再提交保留原键和正文且只扣一次库存', async ({ page }) => {
  const order = await shipmentOrder(page);
  await page.goto(`/outbound/${order.id}`);
  await inputShipment(page, 40, '12');
  const attempts: { key: string | undefined; body: string | null }[] = [];
  await page.route(`**/api/v1/outbound/${order.id}/shipments`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (attempts.length === 1) return route.abort('connectionreset');
    return route.fulfill({ response });
  });

  await page.getByRole('button', { name: '确认本次发货', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /溢发原因/ }).fill('本车分批装运');
  await dialog.getByRole('button', { name: '确认发货', exact: true }).click();
  await expect(dialog.getByText('网络连接中断，请检查网络后重试', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '返回核对', exact: true }).click();
  await page.getByRole('button', { name: '确认本次发货', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: /溢发原因/ })).toHaveValue('本车分批装运');
  const retry = dialog.getByRole('button', { name: '确认发货', exact: true });
  await expect(retry).toBeEnabled();
  await expect(retry).not.toHaveClass(/ant-btn-loading/);
  await retry.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(dialog).toHaveCount(0);

  expect(attempts).toHaveLength(2);
  expect(attempts[0]!.key).toBeTruthy();
  expect(attempts[1]).toEqual(attempts[0]);
  const records = await shipmentRecords(page, order.id);
  expect(records.items).toHaveLength(1);
  expect(records.effectivePackages).toBe(40);
  const db = e2eDatabase();
  try {
    const stock = await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [
      order.lines[0]!.productCode,
    ]);
    expect([Number(stock!.packages), Number(stock!.weight_tonnes)]).toEqual([160, 48]);
  } finally {
    await db.close();
  }
});
