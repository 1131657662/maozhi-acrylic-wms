import { expect, type Page } from '@playwright/test';
import { e2eDatabase } from './inventory-helpers';
import { seedB3cFixtures } from '../../scripts/report-derived-fixtures';

export const chartReports = [
  { kind: 'monthly', query: 'fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P', cards: 3 },
  { kind: 'turnover', query: 'fromDay=2026-04-01&toDay=2026-04-06&product=B3C-DAY', cards: 2 },
  { kind: 'aging', query: 'fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=2026-03-03&product=B3C-COMP', cards: 3 },
] as const;
export async function seedChartEvidence() {
  const db = e2eDatabase();
  try {
    const row = await db.get("SELECT COUNT(*) AS count FROM stock WHERE product_code='B3C-DAY'");
    if (Number(row?.count ?? 0) === 0) await seedB3cFixtures(db);
  } finally {
    await db.close();
  }
}
export function reportResponse(page: Page, kind: string, basis = 'posted') {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(`/web/reports/${kind}`) && url.searchParams.get('basis') === basis;
  });
}
export async function openChart(page: Page, report: (typeof chartReports)[number]) {
  const pending = reportResponse(page, report.kind);
  await page.goto(`/reports/${report.kind}?scope=inventory&basis=posted&${report.query}`);
  const response = await pending;
  expect(response.status()).toBe(200);
  await expect(page.getByTestId('chart')).toHaveAttribute('data-state', 'ready');
  return (await response.json()).data;
}
export async function setReportRange(page: Page, fromDay: string, toDay: string) {
  const inputs = page.locator('.ant-picker-range input');
  await inputs.nth(0).fill(fromDay);
  await inputs.nth(0).press('Tab');
  await inputs.nth(1).fill(toDay);
  await inputs.nth(1).press('Tab');
  await page.getByRole('button', { name: /查\s*询/ }).click();
}
