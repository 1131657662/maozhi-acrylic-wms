import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

test.beforeAll(async () => {
  await mkdir('.local/evidence', { recursive: true });
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});

for (const kind of ['inbound', 'outbound'])
  for (const width of [1440, 1280]) {
    test(`AF-055 ${kind} ${width} 状态完整可读且固定操作不遮挡`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-');
      const list = page.getByTestId(`${kind}-list`);
      await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
      for (const fraction of [0, 0.5, 1]) {
        await list.locator('.ant-table-body').evaluate((body, value) => {
          body.scrollLeft = (body.scrollWidth - body.clientWidth) * value;
        }, fraction);
        await expect
          .poll(() =>
            list.evaluate((root, currentKind) => {
              const body = root.querySelector<HTMLElement>('.ant-table-body')!;
              const action = root.querySelector('thead th[data-column-key="action"]')!.getBoundingClientRect();
              const keys = currentKind === 'inbound' ? ['status', 'postingState'] : ['status'];
              const headers = [...root.querySelectorAll('thead th')].filter(
                (cell) => !cell.classList.contains('ant-table-cell-scrollbar'),
              );
              const readable = keys.every((key) => {
                const cells = [
                  root.querySelector(`thead th[data-column-key="${key}"]`)!,
                  ...root.querySelectorAll(`tbody tr[data-row-key] td[data-export-field="${key}"]`),
                ];
                return cells.every((cell) => {
                  const rect = cell.getBoundingClientRect();
                  const range = document.createRange();
                  range.selectNodeContents(cell);
                  const text = range.getBoundingClientRect();
                  return (
                    rect.width >= 90 &&
                    rect.right <= action.left &&
                    text.left >= rect.left &&
                    text.right <= rect.right &&
                    getComputedStyle(cell).whiteSpace === 'nowrap'
                  );
                });
              });
              return {
                readable,
                scrollCoversColumns:
                  body.scrollWidth >= headers.reduce((total, cell) => total + cell.getBoundingClientRect().width, 0),
                pageWidth: document.documentElement.scrollWidth,
              };
            }, kind),
          )
          .toEqual({ readable: true, scrollCoversColumns: true, pageWidth: width });
      }

      await list.locator('.ant-table-body').evaluate((body) => {
        body.scrollLeft = 0;
      });
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `.local/evidence/b6j-4-final-${kind}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

      const stateHeader = list.locator('thead th[data-column-key="status"]');
      await page.getByTestId('resize-status').focus();
      for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowLeft');
      await expect.poll(() => stateHeader.evaluate((header) => header.getBoundingClientRect().width)).toBe(90);
      const narrow = await list.locator('.ant-table-body').evaluate((body) => ({
        scrollWidth: body.scrollWidth,
        columnWidth: [...body.querySelectorAll('col')].reduce((sum, col) => sum + parseFloat(col.style.width), 0),
      }));
      expect(narrow.scrollWidth).toBe(narrow.columnWidth);
    });
  }
