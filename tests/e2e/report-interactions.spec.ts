import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { reportQuery, recordRows } from './report-helpers';
import { e2eDatabase } from './inventory-helpers';
import { seedB3cFixtures } from '../../scripts/report-derived-fixtures';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    if (!(await db.get("SELECT 1 FROM stock WHERE product_code='B3C-DAY' LIMIT 1"))) await seedB3cFixtures(db);
  } finally {
    await db.close();
  }
});

async function openedPage(page: Page, action: () => Promise<void>) {
  const pending = page.context().waitForEvent('page');
  await action();
  const target = await pending;
  await target.waitForLoadState('domcontentloaded');
  expect(target.url()).not.toMatch(/viewToken|rowTokens|selected|asOf=/);
  return target;
}

test('B7a-3 chips, drawer and deep links share URL selection without clearing basis', async ({ page }) => {
  await page.goto('/reports/details?' + reportQuery + '&basis=restated');
  await expect(recordRows(page, 'details')).not.toHaveCount(0);
  const filters = page.getByRole('region', { name: '视觉筛选' });
  await filters
    .getByRole('group', { name: '方向', exact: true })
    .getByText(/^入库 /)
    .click();
  await expect(page).toHaveURL(/movements=inbound/);
  await expect(recordRows(page, 'details').first()).toBeVisible();
  await page.reload();
  await expect(
    filters.getByRole('group', { name: '方向', exact: true }).locator('.ant-tag-checkable-checked'),
  ).toContainText('入库');
  await page.getByRole('button', { name: '更多筛选' }).click();
  await expect(
    page.getByRole('dialog').locator('.ant-select-selection-item').filter({ hasText: '入库' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: '清除方向' }).click();
  await expect(page).not.toHaveURL(/movements=/);
  await expect(page).toHaveURL(/basis=restated/);
});

test('B7a-3 monthly row and card open automatically queried detail pages with clipped dates and basis', async ({
  page,
}) => {
  await page.goto('/reports/monthly?' + reportQuery + '&basis=restated');
  await expect(recordRows(page, 'monthly')).toHaveCount(18);
  const rowTarget = await openedPage(page, () =>
    recordRows(page, 'monthly').first().locator('td[data-export-field="period"] a').click(),
  );
  await expect(rowTarget).toHaveURL(/basis=restated/);
  await expect(rowTarget).toHaveURL(/warehouseCodes=/);
  await expect(rowTarget).toHaveURL(/productCode=/);
  await expect(rowTarget.getByTestId('list-results')).toBeVisible();
  await rowTarget.close();
  const card = page.getByTestId('report-stat-cards').getByRole('link').first();
  const target = await openedPage(page, () => card.click());
  await expect(target).toHaveURL(/movement=inbound/);
  await expect(target.getByTestId('report-details-list')).toBeVisible();
  await target.close();
});

test('B7a-3 turnover row explains numerator and aging band stays independent with historical stock disabled', async ({
  page,
}) => {
  await page.goto('/reports/turnover?fromDay=2026-04-01&toDay=2026-04-06&product=B3C-DAY&basis=restated');
  await expect(recordRows(page, 'turnover')).toHaveCount(1);
  const target = await openedPage(page, () =>
    recordRows(page, 'turnover').first().locator('td[data-export-field="productName"] a').click(),
  );
  await expect(target).toHaveURL(/movement=outbound/);
  await expect(target.getByText('周转分子：出库量', { exact: true })).toBeVisible();
  await expect(target.getByTestId('report-details-list')).toBeVisible();
  await target.close();
  await page.goto(
    '/reports/aging?fromDay=2026-02-02&toDay=2026-03-03&cutoffDay=2026-03-03&product=B3C-COMP&band=unagedGrams&basis=restated',
  );
  await expect(recordRows(page, 'aging')).toHaveCount(1);
  const cell = recordRows(page, 'aging').first().locator('td[data-export-field="productName"]');
  await expect(cell.locator('[aria-disabled="true"]')).toHaveAttribute('title', /仅截止日为今天/);
  await expect(cell.getByRole('link')).toHaveCount(0);
  const bandTarget = await openedPage(page, () =>
    page.getByTestId('report-stat-cards').getByRole('link').nth(2).click(),
  );
  await expect(bandTarget).toHaveURL(/band=unagedGrams/);
  await expect(recordRows(bandTarget, 'aging')).toHaveCount(1);
  await bandTarget.close();
});
