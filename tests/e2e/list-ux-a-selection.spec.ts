import { expect, type Page, type Locator } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { revealTableCell } from './column-helpers';

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
  await revealTableCell(cell);
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
    await revealTableCell(blank);
    const before = await rowRect(list);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await blank.click();
    await expect(checkbox).toBeChecked();
    // No browser timer has advanced: a delayed row toggle cannot satisfy this assertion.
    await page.clock.resume();
    expect(await rowRect(list)).toEqual(before);
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({ path: `.local/evidence/list-ux-a/${kind}-selection-batch-${width}.png`, fullPage: true });
    }
    await revealTableCell(blank);
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

  test(`B7d ${kind} 双击最终选中并打开详情，焦点行Enter保持`, async ({ page }) => {
    const list = await baseline(page, kind);
    const row = list.locator('tbody tr[data-row-key]').first();
    const id = await row.getAttribute('data-row-key');
    const source = page.url();
    for (const initiallySelected of [false, true]) {
      await row.getByRole('checkbox').setChecked(initiallySelected);
      await row.evaluate((element) => {
        Reflect.get(window, 'b7dSelectionObserver')?.disconnect();
        const selector = `tr[data-row-key="${CSS.escape(element.getAttribute('data-row-key')!)}"]`;
        let previous = element.getAttribute('aria-selected');
        sessionStorage.setItem('row-selection-changes', '[]');
        const observer = new MutationObserver(() => {
          const current = document.querySelector(selector)?.getAttribute('aria-selected');
          if (current == null || current === previous) return;
          previous = current;
          const changes = JSON.parse(sessionStorage.getItem('row-selection-changes')!) as string[];
          changes.push(current);
          sessionStorage.setItem('row-selection-changes', JSON.stringify(changes));
        });
        Object.assign(window, { b7dSelectionObserver: observer });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-selected'],
        });
      });
      const cell = row.locator(`td[data-export-field="${kind === 'inbound' ? 'packages' : 'plannedPackages'}"]`);
      await revealTableCell(cell);
      await page.evaluate(() => window.getSelection()?.removeAllRanges());
      await cell.dblclick({ delay: 60 });
      await expect(page).toHaveURL(new RegExp(`/${kind}/${id}$`));
      const changes: string[] = await page.evaluate(() => JSON.parse(sessionStorage.getItem('row-selection-changes')!));
      expect(changes.at(-1)).toBe('true');
      expect(changes.filter((value) => value === 'false')).toHaveLength(initiallySelected ? 1 : 0);
      await page.goBack();
      await expect(page).toHaveURL(source);
      await expect(row).toBeVisible();
    }
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${kind}/${id}$`));
  });
}
