import { expect, type Page } from '@playwright/test';
import { tonnes, webStockListSchema, WEB_LIST_VIEW_SCHEMA_VERSION, type WebStockRow } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import { revealTableCell, resizeColumn } from './column-helpers';
import { agingCell, agingMovement } from '../../apps/api/tests/stock-aging-fixture';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

const summary = (page: Page, key: string) => page.locator(`[data-summary-field="${key}"]`);
async function assertTotals(page: Page, rows: WebStockRow[]) {
  const sum = (read: (row: WebStockRow) => number) => rows.reduce((total, row) => total + read(row), 0);
  await expect(summary(page, 'packages')).toHaveText(String(sum((row) => row.packages)));
  await expect(summary(page, 'weightGrams')).toHaveText(tonnes(sum((row) => row.weightGrams)));
  for (const key of ['pending', 'available'] as const)
    await expect(summary(page, key)).toHaveText(
      `${sum((row) => row[key].packages)} 包${tonnes(sum((row) => row[key].weightGrams))} 吨`,
    );
}

async function assertAlignment(page: Page) {
  await expect
    .poll(() =>
      page.getByTestId('stock-list').evaluate((root) => {
        const columns = [...root.querySelectorAll<HTMLElement>('thead th[data-column-key]')];
        return columns.every((column) => {
          const cell = root.querySelector(`[data-summary-field="${column.dataset.columnKey}"]`)?.closest('td');
          if (!cell) return false;
          const a = column.getBoundingClientRect(),
            b = cell.getBoundingClientRect();
          return Math.abs(a.x - b.x) < 2 && Math.abs(a.width - b.width) < 2;
        });
      }),
    )
    .toBe(true);
}

test('50 行一次列表请求，当前页合计精确并固定在横纵滚动区底部', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/stock|\/aging/.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/web/lists/stock');
  await page.goto('/stock?product=WL-P&pageSize=50');
  const data = webStockListSchema.parse((await (await response).json()).data);
  await expect(page.getByTestId('stock-aging')).toHaveCount(50);
  await assertTotals(page, data.items);
  expect(requests.filter((url) => new URL(url).pathname === '/api/v1/web/lists/stock')).toHaveLength(1);
  expect(requests.filter((url) => /\/reports\/aging|\/web\/stock\//.test(url))).toHaveLength(0);
  const footer = page.locator('tfoot.ant-table-summary');
  const before = (await footer.boundingBox())!;
  await page
    .getByTestId('stock-list')
    .locator('.ant-table-body')
    .evaluate((body) => {
      body.scrollTop = body.scrollHeight;
      body.scrollLeft = body.scrollWidth;
    });
  await assertAlignment(page);
  expect(Math.abs((await footer.boundingBox())!.y - before.y)).toBeLessThan(2);
  await screenshotWidths(page, 'b6f-2b-stock-summary-right');
  await page
    .getByTestId('stock-list')
    .locator('.ant-table-body')
    .evaluate((body) => {
      body.scrollLeft = 0;
    });
  await screenshotWidths(page, 'b6f-2b-stock-summary');
  console.log('B6F2B_HTTP rows=50 stock_list=1 per_product=0; summary alignment and fixed bottom verified');
});

test('库龄明细五档与未知单列，调整后库龄和本页合计同步刷新', async ({ page }) => {
  const db = e2eDatabase();
  const cell = await agingCell(db);
  try {
    let before = 0;
    for (const days of [181, 91, 61, 31, 0]) {
      await agingMovement(db, cell, { before, delta: 1_000_000, days });
      before += 1_000_000;
    }
  } finally {
    await db.close();
  }
  await page.goto(`/stock?product=${cell.productCode}`);
  await revealTableCell(page.getByTestId('stock-aging'));
  await page.getByTestId('stock-aging').focus();
  for (const label of ['0–30', '31–60', '61–90', '91–180', '>180'])
    await expect(page.getByRole('tooltip')).toContainText(`${label} 天：1.0000 吨`);
  await expect(page.getByTestId('stock-unaging')).toHaveCount(0);
  await screenshotWidths(page, 'b6f-2b-stock-aging');
  await page.getByRole('button', { name: '调整库存', exact: true }).click();
  await page.getByLabel('包数调整量', { exact: true }).fill('2');
  await page.getByLabel('重量调整量（吨）', { exact: true }).fill('0.0001');
  await page.getByLabel('调整原因', { exact: true }).fill('库龄与本页合计刷新验收');
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/web/lists/stock');
  await page.getByRole('button', { name: '确认调整库存' }).click();
  await page.getByRole('button', { name: '确认提交', exact: true }).click();
  const data = webStockListSchema.parse((await (await response).json()).data);
  await expect(page.getByRole('dialog', { name: '库存调整 · 库存商品' })).toBeHidden();
  expect(data.items[0]!.agingBuckets).toEqual([0, 0, 0, 0, 0]);
  expect(data.items[0]!.unagingGrams).toBe(5_000_100);
  await assertTotals(page, data.items);
  await expect(page.getByTestId('stock-unaging')).toHaveText('不可归龄 5.0001 吨');
  await expect(page.getByTestId('stock-unaging').getByRole('img', { name: 'warning' })).toBeVisible();
});

test('合计行跟随列显隐、重排、宽度和固定列；其他列表没有合计行', async ({ page }) => {
  const saved = await page.request.put('/api/v1/me/list-preferences/stock', {
    headers: { Origin: 'http://127.0.0.1:5174' },
    data: {
      schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION,
      columns: {
        pending: { show: false },
        available: { order: 1 },
        weightGrams: { order: 2, width: 220 },
        packages: { order: 3 },
      },
    },
  });
  expect(saved.status()).toBe(200);
  await page.goto('/stock');
  await expect(summary(page, 'productName')).toHaveText('当前页合计');
  await expect(summary(page, 'pending')).toHaveCount(0);
  await assertAlignment(page);
  await resizeColumn(page, 'weightGrams', 40);
  await assertAlignment(page);
  await page
    .getByTestId('stock-list')
    .locator('.ant-table-body')
    .evaluate((body) => {
      body.scrollLeft = body.scrollWidth;
    });
  await assertAlignment(page);
  await page.goto('/inbound');
  await expect(page.getByTestId('inbound-list')).toBeVisible();
  await expect(page.locator('.ant-table-summary')).toHaveCount(0);
});

test('空页合计缺值显示破折号，分页切换仅合计当前页', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  await page.goto('/stock?product=nonexistent-b6f2b');
  await expect(summary(page, 'packages')).toHaveText('—');
  await expect(summary(page, 'pending')).toHaveText('—');
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/web/lists/stock');
  await page.goto('/stock?product=WL-P&page=2&pageSize=50');
  const data = webStockListSchema.parse((await (await response).json()).data);
  await assertTotals(page, data.items);
});
