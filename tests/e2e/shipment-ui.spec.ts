import { expect } from '@playwright/test';
import { test } from './list-test';
import { post, screenshotWidths } from './inventory-helpers';
import {
  shipmentOrder,
  inputShipment,
  sendShipment,
  shipmentRecords,
  shipmentDialogScreenshots,
} from './shipment-ui-helpers';

test('B5c-3 三次人工发货后短关，保留记录和未发证据', async ({ page }) => {
  const order = await shipmentOrder(page);
  await page.goto(`/outbound/${order.id}`);
  await expect(page.getByRole('button', { name: '完成发货', exact: true })).toBeDisabled();
  await expect(page.getByText('还有待发，请继续发货或短关', { exact: true })).toBeVisible();
  for (const amount of [40, 30, 20]) {
    await inputShipment(page, amount, String(amount * 0.3));
    if (amount === 40) {
      await screenshotWidths(page, 'b5c-3-visual-entry');
      await expect(page.getByTestId('actual-lines')).toContainText(/−60 包\s*−18\.0000 吨（欠发）/);
      for (const width of [1440, 1280]) {
        await page.setViewportSize({ width, height: 960 });
        await page
          .getByTestId('actual-lines')
          .locator('.ant-table-content')
          .evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
          });
        await page.screenshot({
          path: `.local/evidence/b5c-3-visual-entry-difference-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
    await sendShipment(page);
    await expect(page.getByText('部分发货', { exact: true }).first()).toBeVisible();
    await expect(page.locator('button.ant-btn-primary:visible')).toHaveCount(1);
  }
  await page.getByRole('button', { name: /短\s*关/, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '确认短关', exact: true }).click();
  await expect(dialog.getByText('请填写短关原因', { exact: true })).toBeVisible();
  await dialog.getByLabel('短关原因', { exact: true }).fill('客户取消剩余数量');
  await expect(dialog.getByText('请填写短关原因', { exact: true })).toHaveCount(0);
  await shipmentDialogScreenshots(page, 'b5c-3-short-close');
  await dialog.getByRole('button', { name: '确认短关', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const records = await shipmentRecords(page, order.id);
  expect(records.items.map((item) => item.packages)).toEqual([40, 30, 20]);
  expect([records.effectivePackages, records.remainingPackages, records.shortClosure?.packages]).toEqual([90, 0, 10]);
  await expect(page.getByRole('button', { name: '本次发货', exact: true })).toHaveCount(0);
});

test('B5c-3 空白按零且全零禁止，溢发由服务端要求逐行原因', async ({ page }) => {
  const order = await shipmentOrder(page, true);
  await page.goto(`/outbound/${order.id}`);
  await page.getByRole('button', { name: '本次发货', exact: true }).click();
  await page.getByRole('button', { name: '确认本次发货', exact: true }).click();
  await expect(page.getByText('本次没有发货数量', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: '本次实发包数 1', exact: true }).fill('101');
  await page.getByRole('spinbutton', { name: '本次实发吨数 1', exact: true }).fill('30.3');
  await expect(page.getByTestId('actual-lines')).toContainText(/\+1 包\s*\+0\.3000 吨（溢发）/);
  await page.getByRole('button', { name: '确认本次发货', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('本次：1 行，共 101 包 / 30.3000 吨');
  await expect(dialog).toContainText('+1 包 / +0.3000 吨（溢发）');
  await expect(dialog.getByRole('textbox', { name: '溢发原因', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: '确认发货', exact: true }).click();
  await expect(dialog.getByText('溢发原因必填', { exact: true })).toBeVisible();
  expect((await shipmentRecords(page, order.id)).items).toHaveLength(0);
  await dialog.getByRole('textbox', { name: /溢发原因/ }).fill('客户追加');
  await expect(dialog.getByText('溢发原因必填', { exact: true })).toHaveCount(0);
  await page.locator('.ant-notification-notice-close').click();
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0);
  await expect(page.getByText('本次没有发货数量', { exact: true })).toHaveCount(0);
  await shipmentDialogScreenshots(page, 'b5c-3-visual-confirm');
  await dialog.getByRole('button', { name: '确认发货', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const records = await shipmentRecords(page, order.id);
  expect(records.items).toHaveLength(1);
  expect(records.items[0]!.lines.map((line) => line.packages)).toEqual([101, 0]);
  expect(records.remainingPackages).toBe(10);
});

test('B5c-3 改计划归零后显式完成，不新增发货记录', async ({ page }) => {
  const order = await shipmentOrder(page);
  await page.goto(`/outbound/${order.id}`);
  await inputShipment(page, 40, '12');
  await sendShipment(page);
  const records = await shipmentRecords(page, order.id);
  const response = await page.request.patch(`/api/v1/outbound/${order.id}/plan`, {
    headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': crypto.randomUUID() },
    data: {
      revision: records.revision,
      digest: records.digest,
      plan: {
        lines: [{ id: order.lines[0]!.id, plannedPackages: 40, plannedWeightGrams: 12000000 }],
      },
    },
  });
  expect(response.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: '完成发货', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '完成发货', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '完成发货', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('已出库', { exact: true }).first()).toBeVisible();
  expect((await shipmentRecords(page, order.id)).items).toHaveLength(1);
});

test('B5c-3 连续两次发满自动结单', async ({ page }) => {
  const order = await shipmentOrder(page);
  await page.goto(`/outbound/${order.id}`);
  for (const amount of [40, 60]) {
    await inputShipment(page, amount, String(amount * 0.3));
    await sendShipment(page);
  }
  await expect(page.getByText('已出库', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '本次发货', exact: true })).toHaveCount(0);
  const records = await shipmentRecords(page, order.id);
  expect([records.effectivePackages, records.remainingPackages, records.remainingWeightGrams]).toEqual([100, 0, 0]);
  const blocked = await post(page, `/outbound/${order.id}/shipments`, {
    revision: records.revision,
    digest: records.digest,
    lines: [{ lineId: order.lines[0]!.id, actualPackages: 1, actualWeightGrams: 300000 }],
  });
  expect(blocked.status()).toBe(409);
});
