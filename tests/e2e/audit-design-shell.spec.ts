import { expect } from '@playwright/test';
import { test } from './list-test';
import { auditPageFixture } from './audit-page-fixture';

for (const width of [1440, 1280]) {
  test(`B6j-2 audit shells use tokens and retain empty/filter/export actions at ${width}`, async ({ page }) => {
    const fixture = await auditPageFixture();
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`/audit?keyword=${encodeURIComponent(fixture.marker)}`);
    await expect(page.getByTestId('audit-list').locator('tbody tr[data-row-key]')).toHaveCount(5);
    const title = page.getByRole('heading', { name: '操作记录', exact: true });
    await expect(title).toHaveCSS('font-size', '20px');
    await expect(title).toHaveCSS('font-weight', '600');
    await expect(title.locator('xpath=../span')).toHaveCSS('font-size', '16px');
    const filter = page.getByTestId('list-filters');
    await expect(filter).toHaveCSS('border-radius', '12px');
    await expect(filter.locator(':scope > .ant-card-body')).toHaveCSS('padding', '24px');
    const stats = page.getByTestId('audit-statistics');
    await expect(stats.locator('strong').first()).toHaveCSS('font-size', '28px');
    await expect(stats.locator('strong').first()).toHaveCSS('line-height', '36px');
    await expect(stats.locator('strong').first()).toHaveCSS('font-weight', '600');
    await expect(stats.getByRole('button', { name: '失败数', exact: true })).toHaveCSS('font-size', '12px');
    await expect(page.getByTestId('audit-list').getByTestId('design-status-tag').first().locator('svg')).toBeVisible();
    await page.getByText('时间线', { exact: true }).click();
    await expect(page.getByTestId('audit-timeline').locator('.ant-card')).toHaveCount(4);
    await expect(page.getByTestId('audit-timeline').getByRole('heading').first()).toHaveCSS('font-size', '16px');
    await page.getByRole('button', { name: '导出', exact: true }).click();
    await expect(page.getByTestId('audit-list')).toBeVisible();
    await expect(page.getByRole('radio', { name: '当前页 · 5 条' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await page.goto(`/audit?keyword=${encodeURIComponent(fixture.marker + '-无结果')}`);
    const empty = page.getByTestId('audit-list').getByRole('status').filter({ hasText: '该时间范围内没有操作记录' });
    await expect(empty).toContainText('该时间范围内没有操作记录');
    expect((await empty.boundingBox())!.height).toBeLessThanOrEqual(120);
    await empty.getByRole('button', { name: '调整筛选' }).click();
    await expect(page.locator('#audit-filters')).toBeVisible();
    await page.getByText('时间线', { exact: true }).click();
    await expect(page.getByTestId('audit-timeline').getByRole('status')).toContainText('该时间范围内没有操作记录');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
