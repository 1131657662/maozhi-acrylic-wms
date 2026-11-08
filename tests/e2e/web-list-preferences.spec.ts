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
  await expect(page.getByText(/已选择 1 条/)).toBeVisible();
  await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
  await expect(page.getByText(/已选择 2 条/)).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索出库单' }).fill('WL-CK-000001');
  await page.getByRole('searchbox', { name: '搜索出库单' }).press('Enter');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(page.getByText(/已选择 2 条/)).toHaveCount(0);
  console.log('B1B1_PREFERENCES hidden_column_reload=preserved cross_page_selection=2 filter_change_selection=0');
});
test('B1b1 多条件筛选与未知状态/空状态原文查询', async ({ page }) => {
  await page.goto('/inbound?keyword=WL-RK-&status=legacy-code');
  const list = page.getByTestId('inbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(20);
  await expect(list.getByTestId('status-tag').first()).toHaveText('状态待识别：legacy-code');
  await page.getByText('展开', { exact: false }).click();
  await page.getByRole('textbox', { name: /^供应商/ }).fill('不存在');
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  await page.goto('/inbound?keyword=WL-RK-&statusMissing=true');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(list.getByTestId('status-tag')).toHaveText('状态待识别：未记录');
  console.log('B1B1_STATUS unknown_raw=visible null_status=1 combined_filter=0');
});
