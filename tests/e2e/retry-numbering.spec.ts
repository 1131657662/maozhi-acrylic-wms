import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/user/login');
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '出库工作台' })).toBeVisible();
}
async function fillReceipt(page: Page) {
  await page.goto('/inbound/new');
  await page.getByLabel('供应商').click();
  await page.getByTitle('合成供应商 · DEMO-SUPPLIER', { exact: true }).click();
  await page.getByLabel('仓库').click();
  await page.getByTitle('合成仓库 · DEMO-WH', { exact: true }).click();
  await page.getByLabel('商品').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'ACR-032' }).click();
  await page.getByLabel('包数', { exact: true }).fill('1');
  await page.getByLabel('本次总重量（吨）').fill('0.3025');
}
test('B1a 创建入库已成功但响应丢失，同表单重试使用原键和正文', async ({ page }) => {
  await login(page);
  await fillReceipt(page);
  const attempts: { key: string | undefined; body: string | null }[] = [];
  let createdId = '';
  await page.route('**/api/v1/inbound', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    const response = await route.fetch();
    if (attempts.length === 1) {
      expect(response.ok()).toBeTruthy();
      createdId = (await response.json()).data.id;
      return route.abort('connectionreset');
    }
    return route.fulfill({ response });
  });
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page.locator('.ant-alert').filter({ hasText: '网络连接中断' })).toBeVisible();
  await expect(page.getByLabel('包数', { exact: true })).toHaveValue('1');
  const retry = page.getByRole('button', { name: /创建待确认入库单$/ });
  await expect(retry).toBeEnabled();
  await expect(retry).not.toHaveClass(/ant-btn-loading/);
  console.log(
    'B1A_RETRY_UI',
    await retry.evaluate((button) => ({ classes: button.className, text: button.textContent })),
  );
  await retry.click();
  await expect(page).toHaveURL(new RegExp(`/inbound/${createdId}$`));
  expect(attempts).toHaveLength(2);
  expect(attempts[0]?.key).toBeTruthy();
  expect(attempts[1]).toEqual(attempts[0]);
});
