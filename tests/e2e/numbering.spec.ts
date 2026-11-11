import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}
async function prepareRecentUnknownJournal() {
  const db = e2eDatabase();
  try {
    // The widget intentionally shows only the latest 20 entries. Own this fixture instead of depending on suite order.
    await db.run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_business_type)
      VALUES('DEMO-WH','ACR-032',0,'0.0000',UTC_TIMESTAMP(3),'legacy_journal_type_current_case')`);
  } finally {
    await db.close();
  }
}
test('B6a-num 固定三位只读，刷新失败保留预览并可重试', async ({ page }) => {
  await page.goto('/system/document-numbering');
  await expect(page.getByText(/预览不占号/)).toBeVisible();
  await expect(page.getByText(/^RK-\d{8}-\d{3}$/)).toBeVisible();
  await expect(page.getByText(/固定 3 位，只读/)).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存编号规则' })).toHaveCount(0);
  await page.getByText('出库 CK', { exact: true }).click();
  const preview = page.getByText(/^CK-\d{8}-\d{3}$/);
  const original = await preview.innerText();
  await page.route('**/api/v1/document-numbering', (route) =>
    route.fulfill({
      status: 500,
      json: { code: 'TEST_ERROR', message: '系统出错了，已记录', data: null, traceId: 'refresh-test' },
    }),
  );
  await page.getByRole('button', { name: '刷新预览' }).click();
  await expect(page.getByText(/系统出错了，已记录/)).toBeVisible();
  await expect(preview).toHaveText(original);
  await page.unroute('**/api/v1/document-numbering');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByText(/系统出错了，已记录/)).toHaveCount(0);
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await noPageOverflow(page);
    await page.screenshot({ path: `.local/evidence/b6a-num-numbering-${width}.png`, fullPage: true });
  }
});

test('B1a 未知状态/流水类型中文回退灰色显示，无异常和伪流程', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?status=legacy_future_state');
  await expect(page.getByTestId('pro-table').getByTestId('status-tag').filter({ hasText: '未识别' })).toBeVisible();
  await page.goto('/outbound/E2E-UNKNOWN-OUT');
  const tag = page.getByTestId('status-tag');
  await expect(tag).toHaveText('未识别');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('不能据此判断是否已出库');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('请按单号核对原始单据');
  await expect(tag).toHaveClass(/ant-tag-default/);
  await expect(page.getByText('PDA 扫码', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '核对并确认出库' })).toBeDisabled();
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-status-1440.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await noPageOverflow(page);
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-status-1280.png', fullPage: true });
  await page.goto('/inbound?status=legacy_inbound_state');
  await expect(page.getByTestId('pro-table').getByTestId('status-tag').filter({ hasText: '未识别' })).toBeVisible();
  await page.goto('/inbound/E2E-UNKNOWN-IN');
  await expect(page.getByTestId('status-tag')).toHaveText('未识别');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('不能据此判断是否已入库');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-inbound-1440.png', fullPage: true });
  await prepareRecentUnknownJournal();
  await page.goto('/stock');
  await expect(page.getByRole('tab')).toHaveCount(0);
  const journal = page.getByTestId('journal-type-tag').filter({ hasText: '未识别' });
  await expect(journal).toBeVisible();
  await expect(journal).toHaveClass(/ant-tag-default/);
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
  await page.screenshot({
    path: '.local/evidence/erp-inventory-unknown-journal-1440.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('B1a 配置空态、可重试错误、无权限及加载态', async ({ page }) => {
  let state = 'loading';
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/document-numbering', async (route) => {
    if (state === 'loading') await waiting;
    const status = state === 'error' ? 500 : state === 'forbidden' ? 403 : 200;
    await route.fulfill({
      status,
      json: { code: status === 200 ? 'OK' : 'TEST_ERROR', message: '测试请求失败', traceId: 'e2e-state', data: [] },
    });
  });
  await page.goto('/system/document-numbering');
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  state = 'error';
  release?.();
  await expect(page.getByRole('button', { name: /重\s*试/ })).toBeVisible();
  state = 'empty';
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByText('暂无编号规则，请刷新重试')).toBeVisible();
  state = 'forbidden';
  await page.getByRole('button', { name: '刷新预览' }).click();
  await expect(page.getByText('无权查看编号规则')).toBeVisible();
});
