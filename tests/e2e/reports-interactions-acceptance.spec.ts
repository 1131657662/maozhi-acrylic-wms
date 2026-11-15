import { expect } from '@playwright/test';
import { test } from './list-test';
import { chartReports, seedChartEvidence } from './report-chart-helpers';
import { recordRows } from './report-helpers';
import { screenshotWidths, e2eDatabase, inventoryCell, receipt, post } from './inventory-helpers';

test.beforeAll(seedChartEvidence);
const reports = [{ kind: 'details', query: 'fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P' }, ...chartReports];
for (const report of reports)
  test(`B7a-3 ${report.kind} fixed totals, reconciliation, and 1440/1280 evidence`, async ({ page }) => {
    const response = page.waitForResponse((r) => r.url().includes(`/web/reports/${report.kind}?`));
    await page.goto(`/reports/${report.kind}?${report.query}`);
    const data = (await (await response).json()).data;
    await expect(page.getByTestId('report-table-reconciliation')).toBeVisible();
    await expect(page.getByTestId('report-watermarks')).not.toContainText(/[a-f0-9]{8}-[a-f0-9-]{27}/i);
    const fields =
      report.kind === 'monthly'
        ? ['inboundGrams', 'outboundGrams']
        : report.kind === 'details'
          ? ['packages', 'weightGrams']
          : report.kind === 'turnover'
            ? ['netOutboundGrams']
            : ['unagedGrams'];
    for (const key of fields) {
      const value = data.totals[key],
        expected = value === null ? '—' : key === 'packages' ? String(value) : (value / 1_000_000).toFixed(4);
      await expect(page.locator(`[data-summary-field="${key}"]`)).toHaveText(expected);
    }
    if (report.kind === 'monthly') await expect(page.locator('[data-summary-field="closingGrams"]')).toHaveText('—');
    if (report.kind === 'turnover') await expect(page.locator('[data-summary-field="turns"]')).toHaveText('—');
    await screenshotWidths(page, `b7a3-${report.kind}`);
    const table = page.getByTestId(`report-${report.kind}-table-shell`);
    const container = await table.locator('.ant-table-container').boundingBox();
    const reconciliation = await page.getByTestId('report-table-reconciliation').boundingBox();
    expect(container).not.toBeNull();
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.x + reconciliation!.width).toBeLessThanOrEqual(container!.x + container!.width);
    await table.locator('.ant-table-body').evaluate(async (el) => {
      el.scrollLeft = el.scrollWidth;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    for (const key of fields) {
      const header = table.locator(`th[data-column-key="${key}"]`),
        footer = table.locator(`[data-summary-field="${key}"]`).locator('..');
      const [a, b] = await Promise.all([header.boundingBox(), footer.boundingBox()]);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(Math.abs(a!.x - b!.x)).toBeLessThan(2);
      expect(Math.abs(a!.width - b!.width)).toBeLessThan(2);
    }
  });

test('B7a-3 aging canvas segment opens independent unaged band and current cutoff opens exact stock', async ({
  page,
}) => {
  await page.goto(
    '/reports/aging?fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=2026-03-03&product=B3C-COMP&basis=restated',
  );
  const canvas = page.getByTestId('chart').locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const pending = page.context().waitForEvent('page');
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  const band = await pending;
  await expect(band).toHaveURL(/band=unagedGrams/);
  await expect(recordRows(band, 'aging')).toHaveCount(1);
  await band.close();
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  await page.goto(
    `/reports/aging?fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=${today}&product=B3C-COMP&basis=restated`,
  );
  await expect(recordRows(page, 'aging')).toHaveCount(1);
  const stockPending = page.context().waitForEvent('page');
  await recordRows(page, 'aging').locator('td[data-export-field="productName"] a').click();
  const stock = await stockPending;
  await expect(stock).toHaveURL(/productCode=B3C-COMP/);
  await expect(stock).toHaveURL(/warehouseCodes=B3C-WH/);
  await expect(stock.getByTestId('stock-list')).toBeVisible();
  await expect(stock.getByText(/此页显示当前库存/)).toBeVisible();
  await stock.close();
});

test('B7a-3 expired export displays the exact refresh instruction', async ({ page }) => {
  await page.goto('/reports/monthly?fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P');
  await expect(recordRows(page, 'monthly')).toHaveCount(18);
  await page.route('**/web/exports', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'EXPORT_VIEW_CHANGED',
            message: '数据已变化，请刷新后重新导出',
            data: null,
            traceId: '',
          }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await expect(page.getByText('数据已变化，请刷新后重新导出', { exact: true }).first()).toBeVisible();
});

test('B7a-3 detail document link opens the original receipt with source conditions', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db),
      target = await receipt(page, cell);
    const result = await post(page, `/inbound/${target.id}/confirm`, {});
    expect(result.status()).toBe(200);
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    await page.goto(`/reports/details?fromDay=${today}&toDay=${today}&productCode=${cell.productCode}&basis=posted`);
    await expect(recordRows(page, 'details')).toHaveCount(1);
    const pending = page.context().waitForEvent('page');
    await recordRows(page, 'details').locator('td[data-export-field="orderNo"] a').click();
    const document = await pending;
    await expect(document).toHaveURL(new RegExp(`/inbound/${target.id}\\?`));
    await expect(document).toHaveURL(/basis=posted/);
    await expect(document.getByRole('heading', { level: 1 })).toHaveText(/^RK-/);
    await expect(document.getByRole('alert')).toContainText('已确认入库');
    await document.close();
  } finally {
    await db.close();
  }
});
