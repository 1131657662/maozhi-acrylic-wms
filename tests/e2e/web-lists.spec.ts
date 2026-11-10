import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

const pages = [
  { kind: 'inbound', path: '/inbound', field: 'keyword', prefix: 'WL-RK-', label: '搜索入库单', sort: '登记时间' },
  { kind: 'outbound', path: '/', field: 'keyword', prefix: 'WL-CK-', label: '搜索出库单', sort: '建单时间' },
  { kind: 'stock', path: '/stock', field: 'product', prefix: 'WL-P', label: '商品', sort: '库存包数' },
  { kind: 'audit', path: '/audit', field: 'action', prefix: 'list.fixture', label: '操作类型', sort: '时间' },
] as const;

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});
async function expand(page: Page) {
  const button = page.getByText('展开', { exact: false });
  if (await button.count()) await button.first().click();
}
async function rowsReady(page: Page, kind: string, count: number) {
  await expect(page.getByTestId(kind + '-list').locator('tbody tr[data-row-key]')).toHaveCount(count);
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
}
async function screenshotWidths(page: Page, name: string) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('list-results')).toBeVisible();
    await expect(page.locator('.ant-skeleton')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: '.local/evidence/' + name + '-' + width + '.png' });
  }
}
for (const item of pages) {
  test('B1b1 ' + item.kind + ' 统一查询/200行/排序/选择清空/双宽度', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(item.path + '?' + item.field + '=' + item.prefix + '&pageSize=200');
    await rowsReady(page, item.kind, 200);
    await expand(page);
    await screenshotWidths(page, 'b1b1-' + item.kind);
    const table = page.getByTestId(item.kind + '-list');
    await table.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
    await expect(table.getByRole('status').filter({ hasText: '变更筛选将清空选择' })).toContainText('已选择 1 条');
    const sorted = page.waitForResponse((res) => res.url().includes('/api/v1/web/lists/' + item.kind + '?'));
    await table.getByRole('columnheader', { name: item.sort, exact: true }).click();
    await expect(page).toHaveURL(/sortBy=/);
    await rowsReady(page, item.kind, 200);
    const expected = await (await sorted).json();
    await expect(table.locator('tbody tr[data-row-key]').first()).toHaveAttribute(
      'data-row-key',
      String(expected.data.items[0].id),
    );
    await expect(table.getByRole('status').filter({ hasText: '变更筛选将清空选择' })).toContainText('已选择 1 条');
    const input =
      item.field === 'keyword'
        ? page.getByRole('searchbox', { name: item.label })
        : page.getByRole('textbox', { name: new RegExp('^' + item.label) });
    await input.fill('NO-MATCH');
    await input.press('Enter');
    await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
    await expect(page.getByText(/已选择 1 条/)).toHaveCount(0);
    await page.getByRole('button', { name: /重\s*置/ }).click();
    await expect(
      page
        .getByTestId(item.kind + '-list')
        .locator('tbody tr[data-row-key]')
        .first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'B1B1_UI ' + JSON.stringify({ page: item.kind, widths: [1440, 1280], rows: 200, pageOverflow: 0, errors: 0 }),
    );
  });
}

for (const item of pages.slice(0, 2)) {
  test('B1b1 ' + item.kind + ' 详情返回保留筛选/页码/排序', async ({ page }) => {
    const query = '?keyword=' + item.prefix + '&page=2&pageSize=20&sortBy=createdAt&direction=asc';
    await page.goto(item.path + query);
    await rowsReady(page, item.kind, 20);
    await page
      .getByTestId(item.kind + '-list')
      .locator('tbody tr[data-row-key] a')
      .first()
      .click();
    await page.getByRole('link', { name: /返回(入库记录|出库工作台)/ }).click();
    expect(new URL(page.url()).search).toBe(query);
    await rowsReady(page, item.kind, 20);
    console.log('B1B1_RETURN ' + item.kind + ' query_and_page=preserved');
  });
}

test('B6b Step 2 商品反查摘要与命中行展开', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/inbound?productCodes=WL-P000001&pageSize=20');
  await rowsReady(page, 'inbound', 1);
  await expect(page.getByTestId('matched-summary')).toContainText('命中：');
  await expect(page.getByTestId('inbound-list')).toContainText('1 单 · 2 行 · 2 包 · 0.6000 吨');
  await page.getByTestId('inbound-list').getByRole('button', { name: '展开命中行' }).first().click();
  await expect(page.getByTestId('matched-lines-table')).toBeVisible();
  await expect(page.getByTestId('matched-lines-table').getByText('WL-P000001', { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '.local/evidence/b6b-step2-inbound-1440.png' });
  console.log('B6B_STEP2_UI inbound=summary+expanded rows=1 width=1440 pageOverflow=0');
});

test('B1b1 日志历史分页与前后值抽屉', async ({ page }) => {
  await page.goto('/audit?action=list.fixture&page=2&pageSize=200');
  await rowsReady(page, 'audit', 40);
  await page.getByTestId('audit-list').getByRole('button', { name: '查看详情' }).first().click();
  await expect(page.getByRole('heading', { name: '操作前' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('"packages": 1', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  console.log('B1B1_LOG_DRAWER page2=40 before=1 after=2 esc=closed');
});
