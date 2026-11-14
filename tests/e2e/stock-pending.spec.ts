import { expect } from '@playwright/test';
import { theme } from 'antd';
import { webStockListSchema } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase, inventoryCell } from './inventory-helpers';
import { revealTableCell } from './column-helpers';
import { pendingPlan } from '../../apps/api/tests/stock-pending-fixture';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

test('50 行待发/可发仅一次库存列表请求，无逐商品附加请求', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  const requests: string[] = [];
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname;
    if (path.includes('/stock') || path.includes('/shipments')) requests.push(path);
  });
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/web/lists/stock');
  await page.goto('/stock?product=WL-P&pageSize=50');
  const expected = webStockListSchema.parse((await (await response).json()).data);
  await expect(page.getByTestId('stock-pending')).toHaveCount(50);
  await expect(page.getByTestId('stock-available')).toHaveCount(50);
  expect(expected.items.length).toBe(50);
  expect(requests.filter((path) => path === '/api/v1/web/lists/stock')).toHaveLength(1);
  expect(requests.filter((path) => path.includes('/shipments') || path.startsWith('/api/v1/web/stock/'))).toHaveLength(
    0,
  );
  console.log('B6F2A_HTTP rows=50 stock_list_requests=1 per_product_requests=0');
});

test('可发负值保留负号、主题错误色与提示，1440/1280 无页面横向溢出', async ({ page }) => {
  const db = e2eDatabase();
  const cell = await inventoryCell(db);
  try {
    await pendingPlan(db, { product: cell.productCode, packages: 9, tonnes: '2.3000' });
  } finally {
    await db.close();
  }
  await page.goto(`/stock?product=${cell.productCode}`);
  await expect(page.getByTestId('stock-pending')).toHaveText('9 包2.3000 吨');
  await expect(page.getByTestId('stock-available-packages')).toHaveText('-3 包');
  await expect(page.getByTestId('stock-available-tonnes')).toHaveText('-0.5000 吨');
  // The active ConfigProvider keeps Ant Design's default error token.
  const errorColor = await page.evaluate((color) => {
    const probe = document.createElement('span');
    probe.style.color = color;
    return probe.style.color;
  }, theme.getDesignToken().colorError);
  await expect(page.getByTestId('stock-available-packages')).toHaveCSS('color', errorColor);
  await expect(page.getByTestId('stock-available-tonnes')).toHaveCSS('color', errorColor);
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await revealTableCell(page.getByTestId('stock-available-tonnes'));
    await page.getByTestId('stock-available').hover();
    await expect(page.getByRole('tooltip')).toHaveText('待发超过在库');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({
      path: `.local/evidence/b6f-2a-stock-shortage-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('前端直接展示服务端可发值，仅负数维度标红', async ({ page }) => {
  await page.route('**/api/v1/web/lists/stock?**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.items = body.data.items
      .slice(0, 1)
      .map((row: object) => ({ ...row, available: { packages: 123, weightGrams: -123400 } }));
    await route.fulfill({ response, json: body });
  });
  await page.goto('/stock');
  await expect(page.getByTestId('stock-available-packages')).toHaveText('123 包');
  await expect(page.getByTestId('stock-available-tonnes')).toHaveText('-0.1234 吨');
  expect(await page.getByTestId('stock-available-packages').evaluate((el) => (el as HTMLElement).style.color)).toBe('');
  expect(await page.getByTestId('stock-available-tonnes').evaluate((el) => (el as HTMLElement).style.color)).not.toBe(
    '',
  );
  await page.getByTestId('stock-available').focus();
  await expect(page.getByRole('tooltip')).toHaveText('待发超过在库');
});
