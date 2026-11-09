import { expect } from '@playwright/test';
import { shanghaiToday, backdateThreshold } from '@wms/contracts';
import { test } from './list-test';
import { screenshotWidths } from './inventory-helpers';

test('B5a 新建业务日期上海默认与超过三个月二次确认', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/outbound/new');
  await expect(page.getByRole('heading', { name: '新建出库计划' })).toBeVisible({ timeout: 45000 });
  await expect(page.getByLabel('业务日期', { exact: true })).toHaveValue(shanghaiToday());
  await page.goto('/inbound/new');
  const field = page.getByLabel('业务日期', { exact: true });
  await expect(field).toHaveValue(shanghaiToday());
  await page.getByLabel('供应商', { exact: true }).click();
  await page.getByText('DEMO-SUPPLIER · 合成供应商', { exact: true }).click();
  await page.getByLabel('仓库', { exact: true }).click();
  await page.getByText('DEMO-WH · 合成仓库', { exact: true }).click();
  await page.getByLabel('商品', { exact: true }).click();
  await page.getByText('ACR-032 · 腈纶原料 · 合成样本', { exact: true }).click();
  await page.getByLabel('包数', { exact: true }).fill('1');
  await page.getByLabel('本次总重量（吨）').fill('0.3025');
  const old = new Date(Date.parse(backdateThreshold(shanghaiToday())) - 86400000).toISOString().slice(0, 10);
  await field.fill(old);
  await field.press('Enter');
  await screenshotWidths(page, 'b5a-business-date');
  const attempts: object[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/v1/inbound') && r.method() === 'POST') attempts.push(r.postDataJSON());
  });
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('确认回填超过 3 个月的业务日期？');
  expect(attempts).toHaveLength(0);
  await page.getByRole('button', { name: '返回核对', exact: true }).click();
  await expect(field).toHaveValue(old);
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  const result = page.waitForResponse((r) => r.url().endsWith('/api/v1/inbound') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '确认回填', exact: true }).click();
  const saved = await result;
  expect(saved.status()).toBe(200);
  expect(saved.request().postDataJSON()).toMatchObject({ businessDate: old, backdateConfirmed: true });
  await expect(page).toHaveURL(/\/inbound\/[a-f0-9-]+$/);
  await expect(page.getByText(old, { exact: true })).toBeVisible();
  console.log(
    'B5A_UI_DATE',
    JSON.stringify({
      defaultShanghai: shanghaiToday(),
      backdate: old,
      beforeConfirmationRequests: 0,
      submitted: saved.request().postDataJSON(),
      status: saved.status(),
    }),
  );
});
