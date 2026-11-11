import { expect } from '@playwright/test';
import { test } from './list-test';
import { reportQuery, recordRows, reportScreen, compareReportDownload } from './report-helpers';

for (const kind of ['details', 'monthly'])
  test(`B3b ${kind} screen and XLSX three scopes, layout`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/reports/' + kind + '?' + reportQuery);
    await expect(recordRows(page, kind)).toHaveCount(kind === 'details' ? 20 : 18, { timeout: 20000 });
    await expect(page.getByTestId('report-reconciliation')).toContainText('时间未核实');
    const first = await reportScreen(page, kind),
      all = [...first];
    await recordRows(page, kind).first().getByRole('checkbox').check();
    if (kind === 'details')
      for (const number of [2, 3]) {
        await page
          .getByTestId('report-' + kind + '-list')
          .locator(`li[title="${number}"]`)
          .click();
        await expect(recordRows(page, kind)).toHaveCount(number === 2 ? 20 : 8);
        all.push(...(await reportScreen(page, kind)));
      }
    const current = await reportScreen(page, kind);
    for (const scope of ['all', 'page', 'selected']) {
      await page.getByRole('button', { name: '导出', exact: true }).click();
      const label =
        scope === 'all'
          ? `全部筛选结果 · ${all.length} 条`
          : scope === 'page'
            ? `当前页 · ${current.length} 条`
            : '选中记录 · 1 条';
      await page.getByRole('radio', { name: label }).check();
      const response = page.waitForResponse((r) => r.url().endsWith('/web/exports') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '生成 XLSX' }).click();
      const created = await response;
      expect(created.status()).toBe(202);
      const id = (await created.json()).data.id;
      await expect(page.locator(`a[href$="/${id}/download"]`)).toBeVisible();
      await compareReportDownload(page, kind, scope, scope === 'all' ? all : scope === 'page' ? current : [first[0]!]);
      await page.keyboard.press('Escape');
      await expect(page.getByText('导出当前列表', { exact: true })).toBeHidden();
    }
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      if (kind === 'monthly' && width === 1280) {
        await page.goto('/reports/monthly?' + reportQuery.replace('RPT-P', 'RPT-GAP'));
        await expect(recordRows(page, kind)).toHaveCount(3);
        await page.getByTestId('report-reconciliation').locator('summary').click();
        await expect(page.getByTestId('report-reconciliation')).toContainText('相邻库存记录的前后数量不衔接');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      for (const field of kind === 'details' ? ['packages', 'weightGrams'] : ['inboundGrams', 'outboundGrams']) {
        const box = await recordRows(page, kind).first().locator(`td[data-export-field="${field}"]`).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      if (kind === 'monthly' || width === 1440)
        await page.screenshot({
          path: `.local/evidence/b3b-${kind}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  });

test('B3b gap, null, empty, denied and retry states are explicit', async ({ page }) => {
  await page.goto('/reports/monthly?' + reportQuery.replace('RPT-P', 'RPT-GAP'));
  const balance = page.getByTestId('report-reconciliation');
  await expect(balance).toContainText('不可验证');
  await balance.locator('summary').click();
  await expect(balance).toContainText('相邻库存记录的前后数量不衔接');
  await page.goto('/reports/monthly?' + reportQuery.replace('RPT-P', 'RPT-NO-MATCH'));
  await expect(page.getByText('没有符合条件的记录，可调整筛选条件或重置后重试')).toBeVisible();
  await page.route('**/web/reports/monthly?**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'FORBIDDEN', message: '无权查看此报表', traceId: 'report-denied', data: null }),
    }),
  );
  await page.reload();
  await expect(page.getByText('没有权限执行此操作')).toBeVisible();
  await page.unroute('**/web/reports/monthly?**');
  await page.route('**/web/reports/monthly?**', (route) => route.abort());
  await page.reload();
  await expect(page.getByText('网络连接中断，请检查网络后重试')).toBeVisible();
  await page.unroute('**/web/reports/monthly?**');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(balance).toBeVisible();
  console.log('B3B_STATES gap=visible missing=not-zero empty=visible denied=403 retry=recovered');
});

test('B3b detail direction filters rows while reconciliation retains both directions', async ({ page }) => {
  await page.goto('/reports/details?' + reportQuery);
  await expect(recordRows(page, 'details')).toHaveCount(20, { timeout: 20000 });
  const balance = page.getByTestId('report-reconciliation'),
    full = await balance.innerText();
  await page.getByLabel('明细方向', { exact: true }).click();
  await page.getByText('入库（含撤销）', { exact: true }).click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(page.getByTestId('report-details-list')).toContainText('查询结果 · 24 条');
  expect(await balance.innerText()).toBe(full);
  await page.getByRole('link', { name: '查看对应月度汇总' }).click();
  await expect(recordRows(page, 'monthly')).toHaveCount(18);
  expect(await balance.innerText()).toBe(full);
  console.log('B3B_DIRECTION_UI rows=24 reconciliation=unchanged monthly=both-directions');
});
