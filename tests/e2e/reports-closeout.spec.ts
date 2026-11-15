import { mkdir } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { chartReports, seedChartEvidence } from './report-chart-helpers';

const correctionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const uuid = /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i;
const reports = [{ kind: 'details', query: chartReports[0].query }, ...chartReports];
const movementHeaders = {
  inboundPackages: '入库（包）',
  inboundGrams: '入库（吨）',
  outboundPackages: '出库（包）',
  outboundGrams: '出库（吨）',
};

test.beforeAll(async () => {
  await seedChartEvidence();
  await mkdir('.local/evidence/b7a-2-closeout', { recursive: true });
});

async function expectMonthlyHeaders(page: Page) {
  const list = page.getByTestId('report-monthly-list');
  for (const [key, label] of Object.entries(movementHeaders)) {
    const header = list.locator(`thead th[data-column-key="${key}"]`);
    await expect(header).toHaveText(label);
    expect(
      await header.evaluate((cell, text) => {
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && node.textContent !== text) node = walker.nextNode();
        if (!node) return false;
        const range = document.createRange();
        range.selectNodeContents(node);
        const bounds = cell.getBoundingClientRect();
        const content = range.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return content.width <= bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      }, label),
    ).toBeTruthy();
  }
}

async function captureMonthlyMeasures(page: Page, width: number) {
  const list = page.getByTestId('report-monthly-list');
  await list.evaluate((root) => {
    const first = root.querySelector('thead th[data-column-key="period"]')!.getBoundingClientRect();
    const packages = root.querySelector('thead th[data-column-key="inboundPackages"]')!.getBoundingClientRect();
    root.querySelector('.ant-table-body')!.scrollLeft += packages.left - first.right;
  });
  await expect
    .poll(() =>
      list.evaluate((root) => {
        const bounds = (key: string) =>
          root.querySelector(`thead th[data-column-key="${key}"]`)!.getBoundingClientRect();
        return (
          bounds('inboundPackages').left >= bounds('period').right &&
          bounds('outboundPackages').right <= bounds('inboundGrams').left
        );
      }),
    )
    .toBeTruthy();
  await page.screenshot({
    path: `.local/evidence/b7a-2-closeout/monthly-measures-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await list.locator('.ant-table-body').evaluate((body) => {
    body.scrollLeft = 0;
  });
}

for (const report of reports) {
  test(`B7a-2 closeout ${report.kind} shows correction counts without UUID at both widths`, async ({ page }) => {
    let count = 2;
    await page.route(`**/web/reports/${report.kind}?**`, async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      // Exercise presentation of an opaque UUID without writing extra database evidence.
      payload.data.watermarks.dateCorrectionMaxId = count ? correctionId : null;
      payload.data.watermarks.dateCorrectionCount = count;
      await route.fulfill({ response, json: payload });
    });
    await page.goto(`/reports/${report.kind}?scope=inventory&basis=restated&${report.query}`);
    const watermarks = page.getByTestId('report-watermarks');
    await expect(watermarks).toContainText('日期更正：2 条');
    await expect(watermarks).toContainText(/流水水位：\s*\d+/);
    await expect(watermarks).toContainText(/数据截至：\s*\d{4}-\d{2}-\d{2}/);
    await expect(page.getByTestId(`report-${report.kind}-list`)).toBeVisible();
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      await expect(page.locator('body')).not.toContainText(uuid);
      if (report.kind === 'monthly') await expectMonthlyHeaders(page);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({
        path: `.local/evidence/b7a-2-closeout/${report.kind}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (report.kind === 'monthly') await captureMonthlyMeasures(page, width);
    }
    count = 0;
    await page.reload();
    await expect(watermarks).toContainText('无日期更正');
    await expect(watermarks).not.toContainText('日期更正：0');
    await expect(page.locator('body')).not.toContainText(uuid);
  });
}
