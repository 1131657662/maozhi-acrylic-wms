import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { resizeColumn, columnMetrics, toggleColumn, resetColumns, reorderColumn } from './column-helpers';

const endpoint = '/api/v1/me/list-preferences/inbound';
const cacheKey = 'b6b-list-preferences:owner:inbound';
const url = '/inbound?keyword=WL-RK-';
async function openList(page: Page) {
  await page.goto(url);
  await expect(page.getByTestId('inbound-list').locator('tbody tr[data-row-key]')).toHaveCount(50);
}
async function savedColumns(page: Page) {
  return (await (await page.request.get(endpoint)).json()).data.columns;
}
test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});

test('B6b 服务端列偏好：拖宽/显隐/顺序，清缓存与新浏览器会话恢复，重置两端', async ({ page, browser }) => {
  test.setTimeout(60000);
  await openList(page);
  await resizeColumn(page, 'receiptNo', 100);
  await toggleColumn(page, 'inbound', '商品型号');
  const original = await columnMetrics(page, 'inbound');
  await reorderColumn(page, 'inbound');
  await expect.poll(async () => (await columnMetrics(page, 'inbound')).order).not.toEqual(original.order);
  await expect.poll(async () => (await savedColumns(page)).receiptNo?.width).toBe(320);
  await expect.poll(async () => (await savedColumns(page)).productModels?.show).toBe(true);
  const saved = await columnMetrics(page, 'inbound');
  await expect
    .poll(async () => (await savedColumns(page)).weightGrams?.order)
    .toBeGreaterThan((await savedColumns(page)).packages.order);
  await page.reload();
  await expect.poll(async () => (await columnMetrics(page, 'inbound')).widths).toEqual(saved.widths);
  expect((await columnMetrics(page, 'inbound')).order).toEqual(saved.order);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(async () => (await columnMetrics(page, 'inbound')).widths).toEqual(saved.widths);
  const fresh = await browser.newContext();
  try {
    const login = await fresh.request.post('http://127.0.0.1:5174/api/v1/auth/login', {
      data: { username: 'owner', password: 'e2e-only-password', channel: 'web' },
    });
    expect(login.ok()).toBeTruthy();
    const other = await fresh.newPage();
    await other.goto('http://127.0.0.1:5174' + url);
    await expect.poll(async () => (await columnMetrics(other, 'inbound')).widths).toEqual(saved.widths);
    expect((await columnMetrics(other, 'inbound')).order).toEqual(saved.order);
  } finally {
    await fresh.close();
  }
  await resetColumns(page, 'inbound');
  await expect.poll(async () => await savedColumns(page)).toEqual({});
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), cacheKey)).toBeNull();
  console.log('B6B_PREFERENCES refresh=kept clearedCache=restored freshBrowserContext=restored reset=server+local');
});

test('B6b 服务端不可达保留缓存；离线修改和离线重置下次进入续传', async ({ page }) => {
  test.setTimeout(60000);
  await openList(page);
  await resizeColumn(page, 'receiptNo', 100);
  await expect.poll(async () => (await savedColumns(page)).receiptNo?.width).toBe(320);
  await page.route('**/api/v1/me/list-preferences/**', (route) => route.abort('connectionrefused'));
  await page.reload();
  await expect.poll(async () => (await columnMetrics(page, 'inbound')).widths.receiptNo).toBe(320);
  await resizeColumn(page, 'receiptNo', 40);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).dirty, cacheKey)).toBe(true);
  await page.unroute('**/api/v1/me/list-preferences/**');
  await page.reload();
  await expect.poll(async () => (await savedColumns(page)).receiptNo?.width).toBe(360);
  await page.route('**/api/v1/me/list-preferences/**', (route) => route.abort('connectionrefused'));
  await resetColumns(page, 'inbound');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).reset, cacheKey)).toBe(true);
  await page.unroute('**/api/v1/me/list-preferences/**');
  await page.reload();
  await expect.poll(async () => await savedColumns(page)).toEqual({});
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), cacheKey)).toBeNull();
  console.log('B6B_PREFERENCES serverUnavailable=cache retained offlineEdit=360 synced offlineReset=synced');
});

test('B6b 旧版本按 key 合并，新列默认120，服务端值覆盖旧浏览器缓存', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await db.run(`INSERT INTO user_list_preferences VALUES(UUID(),'owner','inbound',0,?,UTC_TIMESTAMP(3))`, [
      JSON.stringify({
        receiptNo: { width: 360 },
        packages: { width: 110, show: false, order: 4 },
        retiredColumn: { width: 580 },
      }),
    ]);
  } finally {
    await db.close();
  }
  await page.addInitScript(() =>
    localStorage.setItem('b6b-list-columns:owner:inbound:v0', JSON.stringify({ receiptNo: { width: 280 } })),
  );
  await openList(page);
  await expect.poll(async () => (await columnMetrics(page, 'inbound')).widths.receiptNo).toBe(360);
  expect((await columnMetrics(page, 'inbound')).widths.packages).toBeUndefined();
  await toggleColumn(page, 'inbound', '商品型号');
  expect((await columnMetrics(page, 'inbound')).widths.productModels).toBe(120);
  expect((await columnMetrics(page, 'inbound')).widths.receiptNo).toBe(360);
  console.log('B6B_PREFERENCES upgrade=kept width=360 newColumn=120 retiredColumn=dropped');
});
