import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';

test('B7b eight blocks, one shared request, responsive first screen and deferred charts', async ({ page }) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('workbench-content')).toBeVisible();
  await expect(page.getByTestId('workbench-content')).not.toContainText(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
  );
  await expect(page.getByRole('main')).not.toContainText(/口径|快照|幂等|事务|回滚|落库|校验|枚举|接口/);
  await expect(page.getByTestId('workbench-trend')).toBeVisible();
  for (const title of ['待我处理', '目录健康', '交接证据', '今日车号关联单据', '最近操作', '快捷入口'])
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(requests.filter((url) => url.endsWith('/web/dashboard'))).toHaveLength(1);
  expect(requests.filter((url) => url.includes('/stocktakes?status=counting'))).toHaveLength(0);
  for (const [label, href] of [
    ['登记入库', '/inbound/new'],
    ['新建出库', '/outbound/new'],
    ['开始盘点', '/stocktakes/new'],
    ['上传目录', '/catalog'],
  ])
    await expect(page.getByRole('link', { name: label, exact: true }).first()).toHaveAttribute('href', href!);
  await mkdir('.local/evidence/b7b1', { recursive: true });
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.getByTestId('workbench-todos')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.local/evidence/b7b1/workbench-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
test('B7b missing and failed data retain reasons; refresh recovers', async ({ page }) => {
  let failed = true;
  await page.route('**/api/v1/web/dashboard', async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    if (failed) {
      body.data.catalogHealth = { verification: 'unverifiable', reason: '目录尚未初始化，请上传目录', data: null };
      body.data.today = { verification: 'failed', reason: '该区块加载失败，请刷新重试', data: null };
      body.data.verification = 'failed';
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await expect(page.getByText('部分数据加载失败', { exact: true })).toBeVisible();
  await expect(page.getByText('目录尚未初始化，请上传目录', { exact: true })).toBeVisible();
  await expect(page.getByTestId('workbench-inbound')).toContainText('—');
  await expect(page.getByTestId('workbench-inbound')).not.toContainText('0 吨');
  failed = false;
  await page.getByRole('button', { name: /刷\s*新/, exact: true }).click();
  await expect(page.getByText('部分数据加载失败', { exact: true })).toHaveCount(0);
});

test('B7b early request network failure shows retry without a duplicate automatic request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/web/dashboard', async (route) => {
    calls++;
    if (calls === 1) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('该区块加载失败，请刷新重试', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: /刷\s*新/, exact: true }).click();
  await expect(page.getByTestId('workbench-content')).toBeVisible();
  expect(calls).toBe(2);
});
