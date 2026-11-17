import { mkdir } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { analysisSchema } from '@wms/contracts';
import { test } from './list-test';
import { fulfillAnalysisWithCharts, fulfillAnalysisWithZeros } from './analysis-dashboard-fixtures';

function analysisResponse(page: Page, range?: string, basis?: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/web/analysis') &&
      (!range || `${url.searchParams.get('fromDay')}/${url.searchParams.get('toDay')}` === range) &&
      (!basis || url.searchParams.get('basis') === basis)
    );
  });
}

async function expectDashboardSections(page: Page) {
  await expect(page.getByTestId('analysis-content').locator('section[data-testid^="analysis-"]')).toHaveCount(7);
  await expect(page.getByTestId('analysis-12 个月收发趋势')).toContainText('单位：吨');
  await expect(page.getByTestId('analysis-Top 排行')).toContainText('客户 Top 10');
  await expect(page.getByTestId('analysis-近 183 日收发热力')).toContainText('口径：入账视图');
  await expect(page.getByTestId('analysis-12 个月收发趋势').getByTestId('chart')).toHaveAttribute(
    'data-state',
    'ready',
  );
  await expect(page.getByTestId('analysis-近 183 日收发热力').getByTestId('chart')).toHaveAttribute(
    'data-state',
    'ready',
  );
}

async function captureDashboard(page: Page) {
  await mkdir('.local/evidence/b7b-2', { recursive: true });
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({
      path: `.local/evidence/b7b-2/dashboard-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}

async function expectEmptyCharts(page: Page) {
  for (const section of ['12 个月收发趋势', '期间收发对比', 'Top 排行', '近 183 日收发热力']) {
    const charts = page.getByTestId(`analysis-${section}`).getByTestId('chart'),
      count = section === 'Top 排行' ? 3 : 1;
    await expect(charts).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      const chart = charts.nth(index);
      await expect(chart).toHaveAttribute('data-state', 'empty');
      await expect(chart.locator('div[role="img"]')).toBeHidden();
    }
  }
}

test('analysis dashboard renders each block from one snapshot with a 183-day heatmap', async ({ page }) => {
  const calls: string[] = [];
  await page.clock.setFixedTime(new Date('2026-04-07T04:00:00Z'));
  await page.route('**/api/v1/web/analysis?**', fulfillAnalysisWithCharts);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/web/analysis')) calls.push(request.url());
  });
  const responsePromise = analysisResponse(page, '2026-01-01/2026-03-31', 'posted');
  await page.goto('/dashboard?fromDay=2026-01-01&toDay=2026-03-31&basis=posted');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const data = analysisSchema.parse((await response.json()).data);
  expect(data.heatmap.data?.days).toHaveLength(183);
  await expectDashboardSections(page);
  await expect(page.getByRole('link', { name: '合成商品', exact: true })).toHaveAttribute('href', /productCode=RPT-P1/);
  await expect(page.getByRole('link', { name: '合成客户', exact: true })).toHaveAttribute(
    'href',
    '/outbound?customer=RPT-C1',
  );
  await page.getByText('包数', { exact: true }).click();
  await expect(page.getByTestId('analysis-12 个月收发趋势').getByTestId('chart')).toHaveAttribute(
    'data-state',
    'ready',
  );
  await page.getByText('吨数', { exact: true }).click();
  expect(calls).toHaveLength(1);
  await captureDashboard(page);
});

test('analysis dashboard presets and basis update the URL and query key', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-07T04:00:00Z'));
  const initial = analysisResponse(page, '2026-04-01/2026-04-07', 'posted');
  await page.goto('/dashboard');
  expect((await initial).status()).toBe(200);

  const previousMonth = analysisResponse(page, '2026-03-01/2026-03-31', 'posted');
  const periodSelect = page.getByRole('combobox', { name: '期间' });
  await periodSelect.click();
  await periodSelect.press('ArrowDown');
  await periodSelect.press('Enter');
  await expect(page).toHaveURL(/fromDay=2026-03-01.*toDay=2026-03-31/);
  expect((await previousMonth).status()).toBe(200);

  const restated = analysisResponse(page, '2026-03-01/2026-03-31', 'restated');
  await page.getByText('重述视图', { exact: true }).click();
  expect((await restated).status()).toBe(200);
  await expect(page).toHaveURL(/basis=restated/);
  await periodSelect.click();
  await page.getByText('自定义', { exact: true }).click();
  await expect(page).toHaveURL(/preset=custom/);
  await expect(page).toHaveURL(/fromDay=2026-03-01.*toDay=2026-03-31/);
});

test('verified zero analysis data shows empty states without chart axes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-07T04:00:00Z'));
  await page.route('**/api/v1/web/analysis?**', fulfillAnalysisWithZeros);
  await page.goto('/dashboard?fromDay=2026-04-01&toDay=2026-04-07&basis=posted');
  await expectEmptyCharts(page);
});

test('B7d dashboard Top links navigate in place, preserve range on back, and allow native new tabs', async ({
  page,
}) => {
  await page.route('**/api/v1/web/analysis?**', fulfillAnalysisWithCharts);
  await page.goto('/dashboard?fromDay=2026-01-01&toDay=2026-03-31&basis=posted');
  const source = page.url(),
    pages = page.context().pages().length;
  for (const name of ['合成商品', '合成客户']) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).not.toHaveAttribute('target', '_blank');
    const destination = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new URL(destination!, source).href);
    expect(page.context().pages()).toHaveLength(pages);
    await page.goBack();
    await expect(page).toHaveURL(source);
    const pending = page.context().waitForEvent('page');
    await link.click({ modifiers: ['ControlOrMeta'] });
    const tab = await pending;
    await expect(tab).toHaveURL(new URL(destination!, source).href);
    await expect(page).toHaveURL(source);
    await tab.close();
  }
});
