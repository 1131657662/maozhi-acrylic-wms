import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { e2eDatabase } from './inventory-helpers';

async function login(page: Page): Promise<void> {
  await page.goto('/user/login?redirect=%2F');
  await expect(page.getByRole('heading', { name: '登录工作台' })).toBeVisible({ timeout: 15000 });
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '出库工作台' })).toBeVisible();
}
async function freezeViaPda(api: APIRequestContext): Promise<void> {
  const base = 'http://127.0.0.1:4311/api/v1';
  const auth = await api.post(`${base}/auth/login`, {
    data: { username: 'owner', password: 'e2e-only-password', channel: 'pda' },
  });
  const headers = { Authorization: `Bearer ${(await auth.json()).data.token}` };
  for (const [barcode, weightGrams] of [
    ['DEMO-032-11', 302500],
    ['DEMO-032-12', 297500],
  ]) {
    const scan = await api.post(`${base}/scan/plans/DEMO-001/facts`, {
      headers,
      data: {
        id: randomUUID(),
        barcode,
        weightGrams,
        catalogVersion: 1,
        weightSource: 'catalog',
        deviceId: 'e2e-pda',
        scannedAt: new Date().toISOString(),
        planVersion: 1,
      },
    });
    expect(scan.ok()).toBeTruthy();
  }
  const plan = (await (await api.get(`${base}/scan/plans/DEMO-001`, { headers })).json()).data;
  const freeze = await api.post(`${base}/scan/plans/DEMO-001/submit`, {
    headers: { ...headers, 'Idempotency-Key': randomUUID() },
    data: { revision: plan.revision, digest: plan.digest },
  });
  expect(freeze.ok()).toBeTruthy();
}
test('Web 登录、详情核对与一次出库确认', async ({ page, request }) => {
  const db = e2eDatabase();
  let before = 0;
  try {
    before = Number(
      (await db.get("SELECT weight_tonnes FROM stock WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'"))
        ?.weight_tonnes,
    );
  } finally {
    await db.close();
  }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await freezeViaPda(request);
  await login(page);
  await page.screenshot({ path: '.local/evidence/web-list-1440.png', fullPage: true });
  await page.getByRole('link', { name: 'DEMO-OUT-20261107-001', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'DEMO-OUT-20261107-001' })).toBeVisible();
  await expect(page.getByText('0.3025', { exact: true })).toBeVisible();
  await expect(page.getByText('0.2975', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/web-detail-1440.png', fullPage: true });
  await page.getByRole('button', { name: '核对并确认出库' }).click();
  await page.getByRole('button', { name: '确认出库', exact: true }).click();
  await expect(page.getByRole('button', { name: '已确认出库' })).toBeDisabled();
  await page.getByText('库存概览', { exact: true }).click();
  await expect(page.getByTestId('source-stock')).toHaveAttribute('data-source', 'inventory');
  await page.goto('/stock?product=ACR-032');
  await expect(
    page.getByTestId('stock-list').getByRole('cell', { name: (before - 0.6).toFixed(4), exact: true }),
  ).toBeVisible();
  await page.getByText('操作记录', { exact: true }).click();
  await expect(page.getByTestId('audit-list').getByText('确认出库', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
test('1280 布局、空态和退出登录', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await page.screenshot({ path: '.local/evidence/web-list-1280.png', fullPage: true });
  await page.getByRole('searchbox', { name: '搜索出库单' }).fill('NO-MATCH');
  await page.getByRole('searchbox', { name: '搜索出库单' }).press('Enter');
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible();
});

test('Web 可登记独立包数与总吨数的入库单并维护基础资料', async ({ page }) => {
  await login(page);
  await page.goto('/inbound/new');
  await expect(page.getByRole('heading', { name: '登记入库' })).toBeVisible();
  await expect(page.getByText('确认保存后自动生成 RK 单号')).toBeVisible();
  await page.getByLabel('供应商').click();
  await page.getByTitle('合成供应商 · DEMO-SUPPLIER', { exact: true }).click();
  await page.getByLabel('仓库').click();
  await page.getByTitle('合成仓库 · DEMO-WH', { exact: true }).click();
  await page.getByLabel('商品').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'ACR-032' }).click();
  await page.getByLabel('包数').fill('2');
  await page.getByLabel('本次总重量（吨）').fill('0.7150');
  await page.getByRole('button', { name: '创建待确认入库单' }).click();
  await expect(page.getByRole('heading', { name: /^RK-\d{8}-\d+$/ })).toBeVisible();
  await expect(page.locator('.ant-table-tbody').getByRole('cell', { name: '0.7150', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/inbound-detail-1440.png', fullPage: true });

  await page.goto('/master-data');
  await page.getByRole('tab', { name: '客户' }).click();
  await page.getByRole('button', { name: '新增基础资料' }).click();
  await expect(page.getByRole('dialog').getByText('编码由系统生成')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '编码', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('浏览器验收客户');
  await page.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('浏览器验收客户', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/master-data-1440.png', fullPage: true });
});

test('Web 可新建并编辑尚未扫码的出库计划', async ({ page }) => {
  await login(page);
  await page.goto('/outbound/new');
  await expect(page.getByRole('heading', { name: '新建出库计划' })).toBeVisible();
  await expect(page.getByText('创建成功后自动生成 CK 单号')).toBeVisible();
  await page.getByLabel('客户').click();
  await page.getByTitle('合成客户 1 · DEMO-CUST-1', { exact: true }).click();
  await page.getByLabel('仓库').click();
  await page.getByTitle('合成仓库 · DEMO-WH', { exact: true }).click();
  await page.getByLabel('车牌').fill('E2E-VEHICLE');
  await page.getByLabel('商品').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'ACR-032' }).click();
  await page.getByLabel('计划包数').fill('1');
  await page.getByLabel('计划重量（吨）').fill('0.3025');
  await page.getByRole('button', { name: '创建计划' }).click();
  await expect(page.getByRole('heading', { name: /^CK-\d{8}-\d+$/ })).toBeVisible();
  const orderNo = await page.getByRole('heading', { name: /^CK-\d{8}-\d+$/ }).innerText();
  await page.getByRole('button', { name: '编辑计划' }).click();
  await page.getByLabel('车牌').fill('E2E-VEHICLE-UPDATED');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('E2E-VEHICLE-UPDATED', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: orderNo, exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/outbound-plan-1440.png', fullPage: true });
});
