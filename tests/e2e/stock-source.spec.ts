import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { sourceStockSchema, tonnes } from '@wms/contracts';

async function openStock(page: Page) {
  await page.goto('/stock');
}

async function expectedErpStock(page: Page) {
  const response = await page.request.get('/api/v1/stock/by-source?scope=inventory');
  expect(response.ok()).toBeTruthy();
  const data = sourceStockSchema.parse((await response.json()).data);
  if (data.source !== 'inventory' || !data.subtotal) throw new Error('Expected ERP stock only');
  return data;
}

test('用途隔离：库存仅资格商品，无 SPEC 或未归属入口、空表及请求', async ({ page }) => {
  const errors: string[] = [];
  const stockRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/stock' || path.startsWith('/api/v1/stock/') || path === '/api/v1/web/lists/stock')
      stockRequests.push(request.url());
  });
  await openStock(page);
  const expected = await expectedErpStock(page);
  await expect(page.getByTestId('stock-source-label')).toHaveText('库存口径：库存商品');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByTestId('source-stock')).toHaveCount(1);
  await expect(page.getByTestId('source-stock')).toHaveAttribute('data-source', 'inventory');
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText(String(expected.subtotal.packages));
  await expect(page.getByTestId('stock-subtotal-tonnes')).toHaveText(tonnes(expected.subtotal.weightGrams));
  // Other suites can populate more than one page. Check the current page against the independent full ERP view.
  const visibleRows = page.getByTestId('stock-list').locator('tbody tr[data-row-key]');
  await expect(visibleRows).toHaveCount(Math.min(expected.items.length, 50));
  for (const tableRow of await visibleRows.all()) {
    const identity = await tableRow.getAttribute('data-row-key');
    const row = expected.items.find((item) => JSON.stringify([item.warehouseCode, item.productCode]) === identity);
    expect(row, `Only ERP stock may appear: ${identity}`).toBeDefined();
    if (!row) throw new Error('Visible stock is missing from the ERP-only result');
    await expect(tableRow.getByTestId('stock-row-packages')).toHaveText(String(row.packages));
    await expect(tableRow.getByTestId('stock-row-tonnes')).toHaveText(tonnes(row.weightGrams));
  }
  for (const code of ['ERP-LOOKALIKE', 'SRC-SPEC-A', 'SRC-LOCAL', 'SRC-MISSING']) {
    await expect(page.getByRole('cell', { name: code, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText('未归属', { exact: false })).toHaveCount(0);
  await expect(page.getByText('SPEC 条码目录商品', { exact: false })).toHaveCount(0);
  await expect(page.getByText('库存商品 · 最近 20 条库存流水', { exact: true })).toBeVisible();
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
  await page.screenshot({ path: '.local/evidence/erp-inventory-only-1440.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '.local/evidence/erp-inventory-only-1280.png', fullPage: true });
  expect(stockRequests.length).toBeGreaterThan(0);
  expect(
    stockRequests.every((url) => {
      const request = new URL(url);
      return (
        (request.pathname.startsWith('/api/v1/stock/by-source') || request.pathname === '/api/v1/web/lists/stock') &&
        request.searchParams.get('scope') === 'inventory'
      );
    }),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  console.log(
    `ERP_INVENTORY_ONLY ${JSON.stringify({ tabs: 0, source: expected.source, totalRows: expected.items.length, visibleRows: await visibleRows.count(), subtotal: expected.subtotal, nonErpRequests: 0 })}`,
  );
});

test('商品库存加载及错源重试：无资格 响应不显示、不残留数字', async ({ page }) => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let incorrect = true;
  await page.route('**/api/v1/web/lists/stock?**', async (route) => {
    await waiting;
    const response = await route.fetch();
    const body = await response.json();
    if (incorrect) {
      body.data.source = 'sku-spec';
      body.data.items = body.data.items.map((row: object) => ({ ...row, source: 'sku-spec' }));
    }
    await route.fulfill({ response, json: body });
  });
  await openStock(page);
  const expected = await expectedErpStock(page);
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  await expect(page.getByTestId('source-stock')).toHaveCount(0);
  release?.();
  await expect(page.getByText('列表加载失败，已停止展示旧数据')).toBeVisible();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveCount(0);
  incorrect = false;
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText(String(expected.subtotal.packages));
  await expect(page.getByTestId('source-stock')).toHaveAttribute('data-source', 'inventory');
  console.log('ERP_INVENTORY_RECOVERY wrong_source_display=0; retry=erp-product; tabs=0');
});

test('商品库存空态与无权限：不出现其他用途入口或占位', async ({ page }) => {
  let forbidden = false;
  await page.route('**/api/v1/web/lists/stock?**', (route) =>
    route.fulfill({
      status: forbidden ? 403 : 200,
      json: {
        code: forbidden ? 'FORBIDDEN' : 'OK',
        message: '验收拒绝',
        traceId: 'source-state',
        data: forbidden
          ? null
          : {
              source: 'inventory',
              items: [],
              total: 0,
              page: 1,
              pageSize: 50,
              viewToken: 'empty',
              subtotal: { packages: 0, weightGrams: 0 },
            },
      },
    }),
  );
  await openStock(page);
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText('0');
  await expect(page.getByRole('tab')).toHaveCount(0);
  forbidden = true;
  await page.reload();
  await expect(page.getByText('无权查看此列表')).toBeVisible();
  await expect(page.getByTestId('source-stock')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
});
