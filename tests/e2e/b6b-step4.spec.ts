import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});

test('B6b Step 4 1440 导出面板显示命中明细范围和条数', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const db = e2eDatabase();
  try {
    await db.run("UPDATE inbound_receipts SET posting_state='confirmed' WHERE id='WL-R000130'");
  } finally {
    await db.close();
  }
  await page.goto('/inbound?productCodes=WL-P000130&pageSize=20');
  const list = page.getByTestId('inbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
  await list.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByRole('radio', { name: '命中明细 · 2 行' })).toBeVisible();
  await page.getByRole('radio', { name: '命中明细 · 2 行' }).check();
  await expect(page.getByRole('radio', { name: '全部筛选结果 · 2 行' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '当前页 · 2 行' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '选中记录 · 1 单' })).toBeVisible();
  await expect(page.getByTestId('export-fields')).toHaveText(
    '字段顺序：入库单号、商品编码、商品名称、包数、重量（吨）',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await mkdir('.local/evidence', { recursive: true });
  await page.screenshot({ path: '.local/evidence/b6b-step4-export-panel-1440.png', fullPage: true });
  console.log('B6B_STEP4_PANEL width=1440 schema=matched_lines allLines=2 pageLines=2 selectedDocuments=1 pageOverflow=0');
});
