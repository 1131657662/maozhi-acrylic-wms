import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedB3cFixtures } from '../../scripts/report-derived-fixtures';

const reports = [
  {
    kind: 'turnover',
    query: 'source=erp-product&fromDay=2026-04-01&toDay=2026-04-06&product=B3C-DAY&page=1&pageSize=20&sortBy=warehouseCode&direction=asc',
    summary: '本期含调整 1 笔、含盘点回写 1 次',
  },
  {
    kind: 'aging',
    query: 'source=erp-product&fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=2026-03-03&product=B3C-COMP&page=1&pageSize=20&sortBy=warehouseCode&direction=asc',
    summary: '本期含调整 0 笔、含盘点回写 0 次',
  },
] as const;

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedB3cFixtures(db);
  } finally {
    await db.close();
  }
});

for (const report of reports)
  test(`B3c ${report.kind} presents the shared period summary`, async ({ page }) => {
    const testId = `report-${report.kind}-list`;
    await page.goto(`/reports/${report.kind}?${report.query}`);
    await expect(page.getByTestId(testId).locator('tbody tr[data-row-key]:has(td[data-export-field])')).toHaveCount(1, {
      timeout: 20000,
    });
    const value = page.getByTestId('report-adjustment-summary'),
      item = value.locator('xpath=ancestor::div[contains(@class,"ant-descriptions-item")]');
    await expect(item.locator('.ant-descriptions-item-label')).toHaveText('本期库存变化说明');
    await expect(value).toHaveText(report.summary);
    await mkdir('.local/evidence', { recursive: true });
    await page.screenshot({ path: `.local/evidence/b3c-${report.kind}-1440.png`, fullPage: true, animations: 'disabled' });
    console.log('B3C_SCREEN', JSON.stringify({ kind: report.kind, field: '本期库存变化说明', value: report.summary }));
  });
