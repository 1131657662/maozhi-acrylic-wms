import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});
test('B1b1 列显隐持久化，排序/分页保留选择，改筛选清空', async ({ page }) => {
  await page.goto('/?keyword=WL-CK-&pageSize=20');
  const list = page.getByTestId('outbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(20);
  await list.getByRole('img', { name: 'setting', exact: true }).click();
  const vehicle = page.getByRole('treeitem').filter({ hasText: '车牌' });
  await vehicle.locator('.ant-tree-checkbox').click();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: '出库工作台' }).click();
  await expect(list.getByRole('columnheader', { name: '车牌', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(20);
  await expect(list.getByRole('columnheader', { name: '车牌', exact: true })).toHaveCount(0);
  await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
  await list.locator('li[title="2"]').click();
  await expect(page).toHaveURL(/page=2/);
  await expect(list.getByRole('status').filter({ hasText: '变更筛选将清空选择' })).toContainText('已选择 1 条');
  await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
  await expect(list.getByRole('status').filter({ hasText: '变更筛选将清空选择' })).toContainText('已选择 2 条');
  await page.getByRole('searchbox', { name: '搜索出库单' }).fill('WL-CK-000001');
  await page.getByRole('searchbox', { name: '搜索出库单' }).press('Enter');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(page.getByText(/已选择 2 条/)).toHaveCount(0);
  console.log('B1B1_PREFERENCES hidden_column_reload=preserved cross_page_selection=2 filter_change_selection=0');
});
test('B6b 默认页大小与视图按用户/页面/schema隔离，失效视图自动清理', async ({ page }) => {
  const invalidKey = 'b6b-list-views:owner:outbound:v1';
  await page.addInitScript((key) => {
    if (!localStorage.getItem('b6b-invalid-view-seeded')) {
      localStorage.setItem(key, JSON.stringify([{ schemaVersion: 0, name: '旧视图', params: {}, columns: {} }]));
      localStorage.setItem('b6b-invalid-view-seeded', '1');
    }
  }, invalidKey);
  await page.goto('/?keyword=WL-CK-');
  const list = page.getByTestId('outbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
  expect(await page.evaluate((key) => localStorage.getItem(key), invalidKey)).toBeNull();

  await page.getByRole('textbox', { name: '视图名称' }).fill('出库待查');
  await page.getByRole('button', { name: '保存视图' }).click();
  await page.goto('/?keyword=NO-MATCH');
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  await page.getByRole('combobox', { name: '已保存视图' }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/keyword=WL-CK-/);
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
});
test('B1b1 多条件筛选与未知状态/空状态原文查询', async ({ page }) => {
  await page.goto('/inbound?keyword=WL-RK-&status=legacy-code');
  const list = page.getByTestId('inbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
  await expect(list.getByTestId('status-tag').first()).toHaveText('未识别');
  await page.getByText('展开', { exact: false }).click();
  await page.getByRole('textbox', { name: /^供应商/ }).fill('不存在');
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  await page.goto('/inbound?keyword=WL-RK-&statusMissing=true');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(list.getByTestId('status-tag')).toHaveText('—');
  console.log('B1B1_STATUS unknown_raw=visible null_status=1 combined_filter=0');
});
