import { expect } from '@playwright/test';
import { test } from './list-test';
import { auditPageScreenshots } from './audit-page-screenshots';
import { auditPageFixture } from './audit-page-fixture';
import { screenRows, downloadAndCompare } from './export-helpers';
import { shanghaiToday } from '@wms/contracts';

test('B6c-3 audit page statistics, outcomes, lazy raw and XLSX match visible business fields', async ({ page }) => {
  test.setTimeout(120000);
  const f = await auditPageFixture(),
    rawRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/audit\/[^/]+\/raw/.test(request.url())) rawRequests.push(request.url());
  });
  await page.goto(`/audit?keyword=${encodeURIComponent(f.marker)}`);
  const list = page.getByTestId('audit-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(5);
  await expect(page.getByTestId('audit-statistics')).toContainText('当前筛选');
  for (const label of ['失败', '已取消', '结果待核实', '未记录'])
    await expect(list.locator('td[data-export-field="result"]').getByText(label, { exact: true })).toBeVisible();
  await expect(list.locator('.ant-tag').filter({ hasText: '发布条码目录' })).toHaveClass(/ant-tag-warning/);
  expect(await list.innerText()).not.toMatch(/trace|raw|deleted-|SECRET-|TEST_FAILURE/);
  await expect(list.locator('tbody a')).toHaveCount(0);
  expect(rawRequests).toHaveLength(0);
  await auditPageScreenshots(page, 'list');
  const expected = await screenRows(page, 'audit');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('radio', { name: '当前页 · 5 条' }).check();
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await downloadAndCompare(page, { kind: 'audit', scope: 'b6c3-page', expected });
  await page.getByRole('dialog', { name: '导出当前列表' }).getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '导出当前列表' })).not.toBeVisible();
  await list.locator(`tr[data-row-key="${f.attempt}"]`).getByRole('button', { name: '查看详情' }).click();
  await expect(
    page
      .getByRole('dialog', { name: '操作日志详情' })
      .locator('.ant-pro-descriptions')
      .getByText('RK-页面验收-1', { exact: true }),
  ).toBeVisible();
  expect(rawRequests).toHaveLength(0);
  await auditPageScreenshots(page, 'detail');
  await page.getByRole('dialog').getByText('原始数据', { exact: true }).click();
  await expect(page.getByTestId('audit-raw')).toContainText('[已隐藏]');
  expect(rawRequests).toHaveLength(1);
  expect(await page.getByTestId('audit-raw').innerText()).not.toContain('SECRET-TOKEN');
  await page
    .getByRole('dialog')
    .locator('.ant-drawer-body')
    .evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
  await auditPageScreenshots(page, 'raw');
  await page.keyboard.press('Escape');
  await page.getByText('时间线', { exact: true }).click();
  await expect(page.getByTestId('audit-timeline').locator('.ant-card')).toHaveCount(4);
  expect(await page.getByTestId('audit-timeline').innerText()).not.toMatch(/deleted-|trace|SECRET-/);
  await auditPageScreenshots(page, 'timeline');
  await page.getByText('列表', { exact: true }).click();
  await page.getByRole('button', { name: '失败数', exact: true }).click();
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(page).toHaveURL(/result=failed/);
  await list.locator('.ant-table-body').evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await auditPageScreenshots(page, 'failed');
  console.log(
    'B6C3_PAGE outcomes=4 dangerous_catalog=orange raw_before=0 raw_after=1 deleted_links=0 screenshots=10 xlsx_cells=30 mismatch=0',
  );
});

test('B6c-3 audit filters persist in URL and saved view, only exact today is labelled today', async ({ page }) => {
  const f = await auditPageFixture(),
    today = shanghaiToday();
  const params = new URLSearchParams({
    keyword: f.marker,
    from: `${today}T00:00:00+08:00`,
    to: `${today}T23:59:59.999+08:00`,
  });
  await page.goto(`/audit?${params}`);
  await expect(page.getByTestId('audit-statistics')).toContainText('今日');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByRole('dialog').getByLabel('结果', { exact: true }).click();
  await page.getByTitle('结果待核实', { exact: true }).click();
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(page).toHaveURL(/result=unknown/);
  await expect(page.getByTestId('audit-list').locator('tbody tr[data-row-key]')).toHaveCount(1);
  await page.getByPlaceholder('视图名称').fill('本日待核实');
  await page.getByRole('button', { name: /保存视图/ }).click();
  await page.reload();
  await expect(page.getByTestId('audit-list').getByText('结果待核实', { exact: true })).toBeVisible();
  await expect(page.getByText('筛选 · 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await expect(page.getByTestId('audit-statistics')).toContainText('当前筛选');
  await page.getByRole('combobox', { name: '已保存视图' }).click();
  await page.getByTitle('本日待核实', { exact: true }).click();
  await expect(page).toHaveURL(/result=unknown/);
  await expect(page.getByTestId('audit-statistics')).toContainText('今日');
  console.log('B6C3_FILTERS url=preserved saved_view=restored today=exact');
});
