import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { screenRows, downloadAndCompare } from './export-helpers';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});
const pages = [
  { kind: 'inbound', url: '/inbound?keyword=WL-RK-&sortBy=receiptNo&direction=asc&pageSize=200' },
  { kind: 'outbound', url: '/?keyword=WL-CK-&sortBy=orderNo&direction=asc&pageSize=200' },
  { kind: 'stock', url: '/stock?product=WL-P&sortBy=productCode&direction=asc&pageSize=200' },
  { kind: 'audit', url: '/audit?action=list.fixture&sortBy=id&direction=asc&pageSize=200' },
];
for (const config of pages)
  test(`B1b2 ${config.kind} XLSX 三范围与屏幕逐字段一致`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(config.url);
    const list = page.getByTestId(config.kind + '-list');
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(200);
    const first = await screenRows(page, config.kind);
    await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
    await list.locator('li[title="2"]').click();
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(40);
    const second = await screenRows(page, config.kind);
    await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
    for (const scope of ['all', 'page', 'selected']) {
      await list.getByRole('button', { name: '导出', exact: true }).click();
      await expect(page.getByRole('radio', { name: '全部筛选结果 · 240 条' })).toBeVisible();
      await expect(page.getByRole('radio', { name: '当前页 · 40 条' })).toBeVisible();
      await expect(page.getByRole('radio', { name: '选中记录 · 2 条' })).toBeVisible();
      const scopeLabel =
        scope === 'all' ? '全部筛选结果 · 240 条' : scope === 'page' ? '当前页 · 40 条' : '选中记录 · 2 条';
      await page.getByRole('radio', { name: scopeLabel }).check();
      const created = page.waitForResponse((r) => r.url().endsWith('/web/exports') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '生成 XLSX' }).click();
      const response = await created;
      expect(response.status()).toBe(202);
      const id = (await response.json()).data.id;
      await expect(page.locator(`a[href$="/${id}/download"]`)).toBeVisible();
      const expected = scope === 'all' ? [...first, ...second] : scope === 'page' ? second : [first[0]!, second[0]!];
      await downloadAndCompare(page, { kind: config.kind, scope, expected });
      if (scope === 'page')
        for (const width of [1440, 1280]) {
          await page.setViewportSize({ width, height: 960 });
          await page.evaluate(() => window.scrollTo(0, 0));
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
          const downloadBox = await page.getByRole('link', { name: '下载 XLSX' }).boundingBox();
          expect(downloadBox && downloadBox.y + downloadBox.height <= 960).toBeTruthy();
          await page.screenshot({ path: `.local/evidence/b1b2-${config.kind}-preview-${width}.png`, fullPage: true });
        }
      await page.keyboard.press('Escape');
    }
  });

test('B1b2 列隐藏和重排跟随文件，生成时页面仍可操作', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'b6b-list-columns:owner:outbound:v1',
      JSON.stringify({
        customerName: { show: false },
        createdAt: { show: true, order: 1 },
        vehicleNo: { show: true, order: 2 },
        plannedPackages: { show: true, order: 3 },
      }),
    ),
  );
  await page.goto('/?keyword=WL-CK-&pageSize=20');
  const list = page.getByTestId('outbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(20);
  const expected = await screenRows(page, 'outbound');
  await list.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('radio', { name: '当前页 · 20 条' }).check();
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await downloadAndCompare(page, { kind: 'outbound', scope: 'columns', expected });
  await page.keyboard.press('Escape');
  await list.locator('li[title="2"]').click();
  await expect(page).toHaveURL(/page=2/);
  console.log('B1B2_COLUMNS hidden_customer=true reordered_time=true exact_file_match=true');
});
