import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { chartReports, seedChartEvidence, openChart, reportResponse, setReportRange } from './report-chart-helpers';

test.beforeAll(seedChartEvidence);

for (const report of chartReports) {
  test(`B7a-2 ${report.kind} basis updates chart, cards and table together`, async ({ page }) => {
    const posted = await openChart(page, report);
    await expect(page.getByTestId('report-stat-cards').locator('strong')).toHaveCount(report.cards);
    await expect(page.getByTestId('report-stat-cards').getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('report-visualization')).toHaveAttribute('data-view-token', posted.viewToken);
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/web/reports/${report.kind}?**`, async (route) => {
      if (new URL(route.request().url()).searchParams.get('basis') === 'restated') await hold;
      await route.continue();
    });
    const response = reportResponse(page, report.kind, 'restated');
    await page.getByText('重述视图', { exact: true }).click();
    await expect(page.getByTestId('chart')).toHaveAttribute('data-state', 'loading');
    await expect(page.getByTestId(`report-${report.kind}-list`)).toHaveCount(0);
    await expect(page.getByTestId('report-stat-cards').locator('strong')).toHaveText(Array(report.cards).fill('—'));
    release();
    const restated = (await (await response).json()).data;
    await expect(page.getByTestId('report-visualization')).toHaveAttribute('data-view-token', restated.viewToken);
    await expect(page.getByTestId(`report-${report.kind}-list`)).toBeVisible();
    expect(new URL(page.url()).searchParams.get('basis')).toBe('restated');
    await expect(page.getByTestId('report-watermarks')).toContainText(String(restated.watermarks.journalMaxId));
    await expect(page.getByTestId('chart')).not.toHaveAttribute('data-state', 'loading');
  });

  test(`B7a-2 ${report.kind} empty data and request errors have no axes`, async ({ page }) => {
    await page.goto(`/reports/${report.kind}?basis=posted&${report.query}&warehouse=no-such-chart-warehouse`);
    await expect(page.getByTestId('chart')).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('chart').locator('div[role="img"]')).toBeHidden();
    await expect(page.getByTestId('chart')).toContainText('暂无可展示数据');
    await page.route(`**/web/reports/${report.kind}?**`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'TEMPORARY', message: '报表暂不可用' } }),
      }),
    );
    await page.reload();
    await expect(page.getByTestId('chart')).toHaveAttribute('data-state', 'error', { timeout: 15000 });
    await expect(page.getByTestId('chart').locator('div[role="img"]')).toBeHidden();
    await expect(page.getByTestId('chart')).toContainText('图表暂不可用');
  });
}

for (const kind of ['monthly', 'turnover'] as const) {
  test(`B7a-2 ${kind} shortening the default date preset also shortens the chart`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-04-07T04:00:00Z'));
    const product = kind === 'monthly' ? 'RPT-P' : 'B3C-DAY';
    const defaultResponse = reportResponse(page, kind);
    await page.goto(`/reports/${kind}?basis=posted&product=${product}`);
    const original = (await (await defaultResponse).json()).data;
    expect(original.chart.points.length).toBe(kind === 'monthly' ? 12 : 6);
    const fromDay = kind === 'monthly' ? '2026-02-01' : '2026-04-01';
    const toDay = kind === 'monthly' ? '2026-02-28' : '2026-04-06';
    const shortenedResponse = reportResponse(page, kind);
    await setReportRange(page, fromDay, toDay);
    const response = await shortenedResponse;
    expect(response.status()).toBe(200);
    const shortened = (await response.json()).data;
    expect(shortened.report.fromDay).toBe(fromDay);
    expect(shortened.report.toDay).toBe(toDay);
    expect(shortened.chart.points).toHaveLength(1);
    expect(shortened.chart.points[0].month).toBe(fromDay.slice(0, 7));
    expect(shortened.chart.totals).not.toEqual(original.chart.totals);
    await expect(page.getByTestId('chart')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('chart').getByRole('img')).toHaveAttribute(
      'aria-label',
      new RegExp(fromDay.slice(0, 7)),
    );
    await expect(page.getByTestId('report-visualization')).toHaveAttribute('data-view-token', shortened.viewToken);
    const rows = page.getByTestId(`report-${kind}-list`).locator('tbody tr[data-row-key]:has(td[data-export-field])');
    await expect(rows).toHaveCount(shortened.items.length);
    if (kind === 'turnover') await expect(page.getByTestId('report-stat-cards')).toContainText('14.3');
  });
}

test('B7a-2 charts and cards fit 1440/1280 and resize the same ECharts instance', async ({ page }) => {
  await mkdir('.local/evidence/b7a-2', { recursive: true });
  for (const report of chartReports) {
    await page.setViewportSize({ width: 1440, height: 960 });
    const data = await openChart(page, report);
    const graph = page.getByTestId('chart').getByRole('img');
    const instanceId = await graph.getAttribute('_echarts_instance_');
    expect(instanceId).toBeTruthy();
    if (report.kind === 'aging') {
      await expect(graph).toHaveAttribute('aria-label', /不可归龄 5\.0000 吨/);
      await expect(graph).toHaveAttribute('aria-label', /0–30 天 — 吨/);
      await expect(page.getByTestId('report-stat-cards').locator('strong')).toHaveText(['5.0000', '—', '5.0000']);
    }
    if (report.kind === 'monthly') {
      await expect(page.getByTestId('report-stat-cards').locator('strong')).toHaveText(
        ['inboundGrams', 'outboundGrams', 'netGrams'].map((key) => (data.chart.totals[key] / 1000000).toFixed(4)),
      );
    }
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      await expect(graph).toHaveAttribute('_echarts_instance_', instanceId!);
      await expect(page.getByTestId('chart')).toHaveCSS('height', '320px');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({
        path: `.local/evidence/b7a-2/${report.kind}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.getByTestId('report-stat-cards').locator('[tabindex="0"]').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('来源');
  }
});
