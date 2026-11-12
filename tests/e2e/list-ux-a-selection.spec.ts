import { expect, type Page, type Locator } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

async function baseline(page: Page, kind: 'inbound' | 'outbound') {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  await page.goto(`${kind === 'inbound' ? '/inbound' : '/'}?keyword=WL-${kind === 'inbound' ? 'RK' : 'CK'}-`);
  const list = page.getByTestId(`${kind}-list`);
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
  return list;
}

async function rowRect(list: Locator) {
  return list.locator('.ant-table-container').evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function selectText(page: Page, cell: Locator) {
  await cell.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'center' }));
  const bounds = await cell.evaluate((element) => {
    const text = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });
  await page.mouse.move(bounds.x, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width, bounds.y + bounds.height / 2, { steps: 10 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).not.toBe('');
}

for (const kind of ['inbound', 'outbound'] as const) {
  test(`体验A ${kind} 行点击/键盘/交互与文本选择排除，勾选零位移`, async ({ page }) => {
    const list = await baseline(page, kind);
    const row = list.locator('tbody tr[data-row-key]').first();
    const blank = row.locator(`td[data-export-field="${kind === 'inbound' ? 'packages' : 'plannedPackages'}"]`);
    const checkbox = row.getByRole('checkbox');
    const before = await rowRect(list);
    await blank.click();
    await expect(checkbox).toBeChecked();
    expect(await rowRect(list)).toEqual(before);
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({ path: `.local/evidence/list-ux-a/${kind}-selection-batch-${width}.png`, fullPage: true });
    }
    await blank.click();
    await expect(checkbox).not.toBeChecked();
    await row.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await page.waitForTimeout(350);
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    const text = row.locator(`td[data-export-field="${kind === 'inbound' ? 'weightGrams' : 'plannedWeightGrams'}"]`);
    await selectText(page, text);
    await page.waitForTimeout(350);
    await expect(checkbox).not.toBeChecked();
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    const [detail] = await Promise.all([
      page.context().waitForEvent('page'),
      row
        .getByRole('link')
        .first()
        .click({ modifiers: ['Control'] }),
    ]);
    await expect(detail).toHaveURL(new RegExp(`/${kind}/[^/?]+$`));
    await page.waitForTimeout(350);
    await expect(checkbox).not.toBeChecked();
    await detail.close();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    console.log(
      'LIST_UX_A_SELECTION',
      JSON.stringify({ kind, displacementPx: 0, ...dimensions, textSelectionIgnored: true, linkIgnored: true }),
    );
  });

  test(`体验A ${kind} 双击不改变选择，焦点行Enter打开详情`, async ({ page }) => {
    const list = await baseline(page, kind);
    const row = list.locator('tbody tr[data-row-key]').first();
    const id = await row.getAttribute('data-row-key');
    await row.getByRole('checkbox').check();
    await row.evaluate((element) => {
      sessionStorage.setItem('row-selection-changes', '[]');
      new MutationObserver((records) => {
        const changes = JSON.parse(sessionStorage.getItem('row-selection-changes')!) as string[];
        records.forEach(() => changes.push(String(element.getAttribute('aria-selected'))));
        sessionStorage.setItem('row-selection-changes', JSON.stringify(changes));
      }).observe(element, { attributes: true, attributeFilter: ['aria-selected'] });
    });
    await row
      .locator(`td[data-export-field="${kind === 'inbound' ? 'packages' : 'plannedPackages'}"]`)
      .dblclick({ delay: 60 });
    await expect(page).toHaveURL(new RegExp(`/${kind}/${id}$`));
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('row-selection-changes')!))).toEqual([]);
    await page.goBack();
    await expect(row).toBeVisible();
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${kind}/${id}$`));
  });
}
