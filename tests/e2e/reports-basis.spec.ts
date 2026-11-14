import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedB3cFixtures } from '../../scripts/report-derived-fixtures';

const sharedQuery =
  'scope=inventory&fromDay=2026-11-01&toDay=2026-11-12&warehouse=RPT-W&product=RPT-P&page=1&pageSize=20';
const CONTEXT_LOADING_DELAY_MS = 750;
const reports = [
  { kind: 'details', suffix: '' },
  { kind: 'monthly', suffix: '' },
  { kind: 'turnover', suffix: '' },
  { kind: 'aging', suffix: '&cutoffDay=2026-11-12' },
] as const;
const screenshotReports = [
  {
    kind: 'details',
    title: '出入库明细',
    query: 'scope=inventory&fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P&warehouse=RPT-W',
  },
  {
    kind: 'monthly',
    title: '月度汇总',
    query: 'scope=inventory&fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P&warehouse=RPT-W',
  },
  { kind: 'turnover', title: '周转率', query: 'scope=inventory&fromDay=2026-04-01&toDay=2026-04-06&product=B3C-DAY' },
  {
    kind: 'aging',
    title: '库存库龄',
    query: 'scope=inventory&fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=2026-03-03&product=B3C-COMP',
  },
] as const;

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    const fixture = await db.get("SELECT COUNT(*) AS count FROM stock WHERE product_code='B3C-DAY'");
    if (Number(fixture?.count ?? 0) === 0) await seedB3cFixtures(db);
  } finally {
    await db.close();
  }
});

for (const report of reports)
  test(`B7a-1 ${report.kind} basis selection matches URL and request`, async ({ page }) => {
    await page.goto(`/reports/${report.kind}?${sharedQuery}${report.suffix}`);
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith(`/web/reports/${report.kind}`) && url.searchParams.get('basis') === 'restated';
    });

    await page.getByText('重述视图', { exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    const pageQuery = new URL(page.url()).searchParams,
      requestQuery = new URL(response.url()).searchParams;
    expect(pageQuery.get('basis')).toBe('restated');
    expect(requestQuery.get('basis')).toBe(pageQuery.get('basis'));
    for (const field of ['fromDay', 'toDay', 'warehouse', 'product']) {
      expect(pageQuery.get(field)).toBe(sharedValue(field));
      expect(requestQuery.get(field)).toBe(pageQuery.get(field));
    }
    if (report.kind === 'aging') expect(requestQuery.get('cutoffDay')).toBe('2026-11-12');
  });

function sharedValue(field: string): string | null {
  return new URLSearchParams(sharedQuery).get(field);
}

for (const report of reports)
  test(`B7a-1 ${report.kind} posted results match the default API basis`, async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith(`/web/reports/${report.kind}`) && url.searchParams.get('basis') === 'posted';
    });
    await page.goto(`/reports/${report.kind}?${sharedQuery}${report.suffix}`);
    const postedResponse = await responsePromise,
      postedPayload = await postedResponse.json(),
      defaultQuery = new URLSearchParams(`${sharedQuery}${report.suffix}`);
    expect(postedResponse.status()).toBe(200);
    defaultQuery.delete('basis');

    const defaultResponse = await page.evaluate(
      async ({ kind, query }) => {
        const response = await fetch(`/api/v1/web/reports/${kind}?${query}`);
        return { status: response.status, body: await response.json() };
      },
      { kind: report.kind, query: defaultQuery.toString() },
    );
    expect(defaultResponse.status).toBe(200);

    const comparable = (data: Record<string, unknown>) => {
      const { watermarks: _watermarks, viewToken: _viewToken, rowTokens: _rowTokens, ...stable } = data;
      return stable;
    };
    expect(comparable(defaultResponse.body.data)).toEqual(comparable(postedPayload.data));
  });

test('B7a-1 shared report shell fits 1440px and 1280px', async ({ page }) => {
  await mkdir('.local/evidence', { recursive: true });
  for (const report of screenshotReports) {
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`/reports/${report.kind}?${report.query}&basis=restated&page=1&pageSize=20`);
      await expect(page.getByRole('heading', { name: report.title, exact: true })).toBeVisible();
      await expect(page.getByTestId('report-context-bar')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({
        path: `.local/evidence/b7a-1-${report.kind}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});

test('B7a-1 reset filters preserves the current basis', async ({ page }) => {
  await page.goto(`/reports/monthly?${sharedQuery}&basis=restated`);
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/web/reports/monthly') && url.searchParams.get('basis') === 'restated';
  });
  await page.getByRole('button', { name: /本\s*月/ }).click();
  const response = await responsePromise;
  const pageQuery = new URL(page.url()).searchParams;
  expect(pageQuery.get('basis')).toBe('restated');
  expect(new URL(response.url()).searchParams.get('basis')).toBe('restated');
  expect(pageQuery.has('warehouse')).toBe(false);
  expect(pageQuery.has('product')).toBe(false);
});

test('B7a-1 restated context shows snapshot watermarks', async ({ page }) => {
  const responsePromise = page.waitForResponse((item) => {
    const url = new URL(item.url());
    return url.pathname.endsWith('/web/reports/monthly') && url.searchParams.get('basis') === 'restated';
  });
  await page.goto(`/reports/monthly?${sharedQuery}&basis=restated`);
  const context = page.getByTestId('report-context-bar'),
    watermarks = page.getByTestId('report-watermarks');
  await expect(context).toBeVisible();
  await expect(page.getByTestId('report-basis-label')).toContainText('重述视图 · 按有效业务日期');
  await expect(watermarks).toContainText('数据截至');
  const response = await responsePromise;
  const result = await response.json(),
    text = await watermarks.innerText();
  expect(text).toContain(String(result.data.watermarks.journalMaxId));
  expect(text).toContain(result.data.watermarks.dateCorrectionMaxId ?? '无日期更正记录');
});

test('B7a-1 context keeps the selected basis visible while loading', async ({ page }) => {
  await page.route('**/web/reports/monthly?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, CONTEXT_LOADING_DELAY_MS));
    await route.continue();
  });
  await page.goto(`/reports/monthly?${sharedQuery}&basis=restated`);

  await expect(page.getByTestId('report-context-bar')).toBeVisible();
  await expect(page.getByTestId('report-basis-label')).toContainText('重述视图 · 按有效业务日期');
  await expect(page.getByTestId('report-watermarks')).toContainText('读取中');
});

test('B7a-1 unverifiable restated balance shows its reason without a zero value', async ({ page }) => {
  const reason = '测试原因：缺少期初锚点';
  await page.route('**/web/reports/monthly?**', async (route) => {
    const response = await route.fetch(),
      payload = await response.json();
    payload.data.balanceMode = 'unverifiable';
    payload.data.restatedBalance = {
      openingPackages: null,
      openingGrams: null,
      closingPackages: null,
      closingGrams: null,
      differencePackages: null,
      differenceGrams: null,
      checkState: '不可验证',
      reasons: [reason],
    };
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });

  await page.goto(`/reports/monthly?${sharedQuery}&basis=restated`);
  const notice = page.getByTestId('report-unverifiable-notice');
  await expect(notice).toContainText(reason);
  expect(await notice.innerText()).not.toContain('0');
});
