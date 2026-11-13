import { expect } from '@playwright/test';
import { test } from './list-test';
import { masterPage, mockProduct, searchOptions, searchPopup } from './master-search-helpers';

test('B6g-2 搜索失败保留中文重试入口，重试恢复候选', async ({ page }) => {
  let failing = true;
  await page.route('**/api/v1/master/products?**', async (route) => {
    if (failing) await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '服务暂时不可用' } });
    else await masterPage(route, [mockProduct('RETRY')]);
  });
  await page.goto('/inbound/new');
  await page.getByLabel('商品', { exact: true }).fill('retry');
  await expect(searchPopup(page)).toContainText('加载失败，请重试');
  failing = false;
  await searchPopup(page).getByRole('button', { name: '重试', exact: true }).click();
  await expect(searchOptions(page)).toContainText('RETRY');
});
