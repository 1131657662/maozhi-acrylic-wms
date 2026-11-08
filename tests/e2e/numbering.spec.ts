import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { numberingRulesSchema } from '@wms/contracts';
import { e2eDatabase } from './inventory-helpers';

async function prepareCollision(page: Page) {
  const response = await page.request.get('/api/v1/document-numbering');
  expect(response.status()).toBe(200);
  const rule = numberingRulesSchema.parse((await response.json()).data).find((row) => row.kind === 'outbound')!;
  const next = rule.preview!;
  expect(next).toMatch(/^CK-\d{8}-\d{4}$/);
  const sequence = String(Number(next.split('-').at(-1)));
  const narrow = next.replace(/-\d+$/, '-' + sequence.padStart(2, '0'));
  const db = e2eDatabase();
  try {
    // Other tests legitimately consume numbers. Construct the collision at the actual next number.
    if (!(await db.get('SELECT id FROM outbound_orders WHERE order_no=?', [narrow])))
      await db.run(
        `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,status,created_at)
        VALUES(?,?,'合成碰撞验收','DEMO-CUST-1','DEMO-WH','验收车辆','open',UTC_TIMESTAMP(3))`,
        [randomUUID(), narrow],
      );
  } finally {
    await db.close();
  }
  return { next, wide: next.replace(/-\d+$/, '-' + sequence.padStart(5, '0')) };
}

async function login(page: Page) {
  await page.goto('/user/login');
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '出库工作台' })).toBeVisible();
}
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
test('B1a 编号配置预览、调窄撞号拒绝且保留输入，修改成功', async ({ page }) => {
  await login(page);
  const expected = await prepareCollision(page);
  await page.goto('/system/document-numbering');
  await expect(page.getByText(/预览不占号/)).toBeVisible();
  await expect(page.getByText(/^RK-\d{8}-\d{4}$/)).toBeVisible();
  await page.getByText('出库 CK', { exact: true }).click();
  await expect(page.getByText(expected.next, { exact: true })).toBeVisible();
  await page.getByLabel('序号宽度', { exact: true }).fill('2');
  const collisionResponse = page.waitForResponse(
    (response) => response.url().endsWith('/document-numbering/outbound') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存编号规则' }).click();
  expect((await collisionResponse).status()).toBe(409);
  await expect(page.getByText(/下一单号 CK-.*已存在.*原配置未改变/)).toBeVisible();
  await expect(page.getByLabel('序号宽度', { exact: true })).toHaveValue('2');
  await page.screenshot({ path: '.local/evidence/b1a-numbering-collision-1440.png', fullPage: true });
  await page.route('**/api/v1/document-numbering', (route) =>
    route.fulfill({
      status: 500,
      json: { code: 'TEST_ERROR', message: '刷新暂时失败', data: null, traceId: 'refresh-test' },
    }),
  );
  await page.getByRole('button', { name: '刷新预览' }).click();
  await expect(page.getByText(/刷新暂时失败/)).toBeVisible();
  await expect(page.getByLabel('序号宽度', { exact: true })).toHaveValue('2');
  await page.unroute('**/api/v1/document-numbering');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByText(/刷新暂时失败/)).toHaveCount(0);
  await page.getByLabel('序号宽度', { exact: true }).fill('5');
  await page.getByRole('button', { name: '保存编号规则' }).click();
  await expect(page.getByText('编号配置已保存')).toBeVisible();
  await expect(page.getByText(expected.wide, { exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: '.local/evidence/b1a-numbering-1440.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await noPageOverflow(page);
  await page.screenshot({ path: '.local/evidence/b1a-numbering-1280.png', fullPage: true });
});

test('B1a 未知状态/流水类型真实数据原文灰色显示，无异常和伪流程', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await expect(page.getByTestId('status-tag').filter({ hasText: 'legacy_future_state' })).toBeVisible();
  await page.goto('/outbound/E2E-UNKNOWN-OUT');
  const tag = page.getByTestId('status-tag');
  await expect(tag).toHaveText('状态待识别：legacy_future_state');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('不能据此判断是否已出库');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('请按单号核对原始单据');
  await expect(tag).toHaveClass(/ant-tag-default/);
  await expect(page.getByText('PDA 扫码', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '核对并确认出库' })).toBeDisabled();
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-status-1440.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await noPageOverflow(page);
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-status-1280.png', fullPage: true });
  await page.goto('/inbound');
  await expect(page.getByTestId('status-tag').filter({ hasText: 'legacy_inbound_state' })).toBeVisible();
  await page.goto('/inbound/E2E-UNKNOWN-IN');
  await expect(page.getByTestId('status-tag')).toHaveText('状态待识别：legacy_inbound_state');
  await expect(page.getByTestId('unknown-status-notice')).toContainText('不能据此判断是否已入库');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: '.local/evidence/b1a2-unknown-inbound-1440.png', fullPage: true });
  await prepareRecentUnknownJournal();
  await page.goto('/stock');
  await expect(page.getByRole('tab')).toHaveCount(0);
  const journal = page.getByTestId('journal-type-tag').filter({ hasText: 'legacy_journal_type_current_case' });
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
  await login(page);
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
  await expect(page.getByText('无权修改编号规则')).toBeVisible();
});
