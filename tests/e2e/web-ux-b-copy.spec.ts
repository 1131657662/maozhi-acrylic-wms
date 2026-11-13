import { expect } from '@playwright/test';
import { test } from './list-test';

for (const [name, path, ready] of [
  ['master', '/master-data', '基础资料'],
  ['inbound', '/inbound/new', '登记入库'],
  ['report', '/reports/details', '出入库明细'],
  ['stocktake', '/stocktakes', '库存盘点'],
  ['catalog', '/catalog', '条码目录'],
])
  test(`B 文案：${name} 页面使用业务中文`, async ({ page }) => {
    await page.goto(path!);
    await expect(
      page
        .locator(name === 'master' || name === 'catalog' ? 'h1' : '.ant-page-header-heading-title')
        .filter({ hasText: ready! }),
    ).toBeVisible();
    await expect(page.locator('.ant-skeleton')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      /口径|快照|主数据|幂等|事务|回滚|落库|校验|枚举|字段|接口|参数|占位|待接入|硬编码/,
    );
    if (name === 'report') await expect(page.getByText('按入账日期统计', { exact: true })).toBeVisible();
    await page.screenshot({ path: `.local/evidence/web-ux-b/copy-${name}-1440.png`, fullPage: true });
  });
